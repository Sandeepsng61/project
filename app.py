from flask import Flask, render_template, request, jsonify, redirect, url_for, session ,flash
from werkzeug.security import generate_password_hash, check_password_hash
from flask_cors import CORS
from pymongo import MongoClient
import datetime
import logging
import os
from bson import json_util
import json
import random
# Load environment variables
app = Flask(__name__)
app.secret_key = 'supersecret123'  # REQUIRED for session to work

# Connect to Compass (local MongoDB)
client = MongoClient("mongodb://localhost:27017/")
db = client['ss_pc_assembler_db']  # Create or use existing database
users_collection = db["users"]  # Yeh define karo
orders_collection = db["orders"]
wishlist_collection = db['wishlist']

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/dashboard')
def dashboard():
    if 'user' in session:
        return render_template('dashboard.html', username=session['user'])
    else:
        flash("Please login first!", "warning")
        return redirect(url_for('login'))

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        username = request.form['username']
        password = request.form['password']
        user = users_collection.find_one({'username': username})

        if user and check_password_hash(user['password'], password):
            session['user'] = user['username']
            flash('Login successful!', 'success')
            return redirect(url_for('dashboard'))
        else:
            flash('Invalid username or password.', 'danger')

    return render_template('login.html')

@app.route('/signup', methods=['GET', 'POST'])
def signup():
    if request.method == 'POST':
        username = request.form['username']
        email = request.form['email']
        password = request.form['password']

        hashed_password = generate_password_hash(password, method='pbkdf2:sha256')

        if users_collection.find_one({'username': username}):
            flash('Username already exists.', 'danger')
        else:
            users_collection.insert_one({
                'username': username,
                'email': email,
                'password': hashed_password
            })
            flash('Signup successful! Please log in.', 'success')
            return redirect(url_for('login'))

    return render_template('signup.html')

@app.route('/logout')
def logout():
    session.pop('user', None)
    flash('Logged out successfully.', 'info')
    return redirect(url_for('login'))

@app.route('/home')
def home():
    return render_template('index.html')

CORS(app)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# MongoDB Connection
def get_mongo_client():
    mongo_uri = os.getenv("MONGO_URI", "mongodb://localhost:27017/")
    return MongoClient(
        mongo_uri,
        serverSelectionTimeoutMS=5000,
        connectTimeoutMS=30000,
        socketTimeoutMS=30000
    )

try:
    client = get_mongo_client()
    client.server_info()  # Test connection
    db = client.pc_assembler
    logger.info("Successfully connected to MongoDB")
except Exception as e:
    logger.error(f"MongoDB connection error: {e}")
    raise

# MongoDB Indexes
def create_indexes():
    try:
        db.parts.create_index("name", unique=True)
        db.assembled_pcs.create_index("timestamp")
        db.parts.create_index("category")
        logger.info("Database indexes created")
    except Exception as e:
        logger.error(f"Error creating indexes: {e}")

create_indexes()

# Helper Functions
def parse_json(data):
    return json.loads(json_util.dumps(data))

def validate_part_data(data):
    required_fields = ['name', 'price', 'category']
    if not all(field in data for field in required_fields):
        return False, "Missing required fields"
    if not isinstance(data['price'], (int, float)) or data['price'] <= 0:
        return False, "Price must be a positive number"
    if not isinstance(data['name'], str) or len(data['name']) < 2:
        return False, "Invalid part name"
    return True, ""

# Routes
@app.route("/submit-order", methods=["POST"])
def submit_order():
    try:
        data = request.get_json()

        # MongoDB me insert karo
        db.assembled_pcs.insert_one({
            "name": data["fullName"],
            "email": data["email"],
            "address": data["address"],
            "paymentMethod": data["paymentMethod"],
            "cart": data["cart"],
            "totalPrice": data["totalPrice"],
            "orderId": data["orderId"],
            "created_at": datetime.datetime.utcnow()
        })

        print(f"📦 Order received: {data['orderId']}")
        return jsonify({"status": "success", "message": "Order saved!"})
    except Exception as e:
        print("Error saving order:", str(e))
        return jsonify({"status": "error", "message": "Failed to save order"}), 500

@app.route("/payment")
def payment():
    return render_template("payment.html")

@app.route("/confirmation")
def confirmation():
    # Optional: order_id, user fetch from session/localStorage if needed
    return render_template("confirmation.html")

# Route for wishlist page
@app.route('/wishlist', methods=['GET', 'POST'])
def wishlist():
    if 'user' in session:
        # Fetch the user from the session
        user = session['user']
        
        # Fetch user's wishlist from MongoDB
        user_wishlist = wishlist_collection.find_one({'username': user})

        # If the user doesn't have a wishlist, create an empty one
        if not user_wishlist:
            user_wishlist = {'username': user, 'items': []}

        return render_template('wishlist.html', wishlist_items=user_wishlist['items'])
    else:
        flash('Please login to view your wishlist.', 'warning')
        return redirect(url_for('login'))

# Route to add items to the wishlist
@app.route('/add_to_wishlist', methods=['POST'])
def add_to_wishlist():
    if 'user' in session:
        user = session['user']
        product_id = request.form['product_id']
        
        # Check if the product is already in the wishlist
        user_wishlist = wishlist_collection.find_one({'username': user})

        if user_wishlist:
            if product_id not in user_wishlist['items']:
                wishlist_collection.update_one(
                    {'username': user},
                    {'$push': {'items': product_id}}
                )
                flash('Item added to your wishlist!', 'success')
            else:
                flash('Item is already in your wishlist!', 'warning')
        else:
            # Create a new wishlist for the user if it doesn't exist
            wishlist_collection.insert_one({
                'username': user,
                'items': [product_id]
            })
            flash('Item added to your wishlist!', 'success')

        return redirect(url_for('wishlist'))
    else:
        flash('Please login to add items to your wishlist.', 'warning')
        return redirect(url_for('login'))

@app.route('/cart')
def cart():
    cart_ids = session.get('cart', [])
    all_products = list(db.parts.find({}, {"_id": 0}))  # fetch all products
    cart_items = [p for p in all_products if p.get('id') in cart_ids]
    return render_template('cart.html', cart=cart_items)

@app.route('/place_order', methods=['POST'])
def place_order():
    name = request.form['name']
    email = request.form['email']
    items = request.form.getlist('items')  # e.g., from a cart

    order_data = {
        'name': name,
        'email': email,
        'items': items
    }

    orders_collection.insert_one(order_data)
    flash("Order placed successfully!", "success")
    return redirect('/confirmation')


@app.route('/gaming_console')
def gaming_console():
    return render_template("gaming_console.html")

@app.route('/contactus')
def contactus():
    return render_template("contactus.html")

@app.route('/add_to_cart', methods=['POST'])
def add_to_cart():
    product_id = int(request.form['product_id'])

    if 'cart' not in session:
        session['cart'] = []

    if product_id not in session['cart']:
        session['cart'].append(product_id)
        session.modified = True
        print("Cart contents:", session['cart'])  # DEBUG PRINT
        flash("Item added to cart!")
    else:
        flash("Item already in cart!")

    return redirect(url_for('prebuiltpc'))


@app.route('/prebuiltpc')
def prebuiltpc():
    return render_template("prebuiltpc.html")

@app.route("/checkout")
def checkout():
    return render_template("checkout.html")
@app.route('/intel-pc')
def intel_pc():
    return render_template('intel_pc.html')

@app.route('/amd-pc')
def amd_pc():
    return render_template('amd_pc.html')
@app.route("/parts", methods=["GET"])
def get_parts():
    try:
        category = request.args.get('category')
        query = {"category": category} if category else {}
        parts = list(db.parts.find(query, {"_id": 0}))
        return jsonify(parts), 200
    except Exception as e:
        logger.error(f"Error fetching parts: {str(e)}", exc_info=True)
        return jsonify({"error": "Failed to fetch parts"}), 500

@app.route("/add_part", methods=["POST"])
def add_part():
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "No data provided"}), 400

        valid, message = validate_part_data(data)
        if not valid:
            return jsonify({"error": message}), 400

        if db.parts.find_one({"name": data["name"]}):
            return jsonify({"error": "Part already exists"}), 409

        part = {
            "name": data["name"],
            "price": float(data["price"]),
            "category": data["category"],
            "created_at": datetime.datetime.utcnow()
        }
        db.parts.insert_one(part)
        return jsonify({"message": "Part added successfully"}), 201
    except Exception as e:
        logger.error(f"Error adding part: {str(e)}", exc_info=True)
        return jsonify({"error": "Failed to add part"}), 500

@app.route("/delete_part/<string:name>", methods=["DELETE"])
def delete_part(name):
    try:
        if not name:
            return jsonify({"error": "Part name required"}), 400

        result = db.parts.delete_one({"name": name})
        if result.deleted_count == 0:
            return jsonify({"error": "Part not found"}), 404

        return jsonify({"message": "Part deleted successfully"}), 200
    except Exception as e:
        logger.error(f"Error deleting part: {str(e)}", exc_info=True)
        return jsonify({"error": "Failed to delete part"}), 500

@app.route("/orders", methods=["GET"])
def get_orders():
    try:
        limit = int(request.args.get('limit', 10))
        orders = list(db.assembled_pcs.find().sort("created_at", -1).limit(limit))
        return jsonify(parse_json(orders)), 200
    except Exception as e:
        logger.error(f"Error fetching orders: {str(e)}", exc_info=True)
        return jsonify({"error": "Failed to fetch orders"}), 500

# Error Handlers
@app.errorhandler(404)
def not_found(error):
    return jsonify({"error": "Resource not found"}), 404

@app.errorhandler(500)
def server_error(error):
    logger.error(f"Server error: {str(error)}")
    return jsonify({"error": "Internal server error"}), 500

if __name__ == "__main__":
    app.run(host='0.0.0.0', port=5000, debug=True)(
    
        host=os.getenv("FLASK_HOST", "0.0.0.0"),
        port=int(os.getenv("FLASK_PORT", 5000)),
        debug=os.getenv("FLASK_DEBUG", "false").lower() == "true"
    )