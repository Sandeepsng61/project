$(document).ready(function () {
    // Initialize cart from localStorage
    let cart = JSON.parse(localStorage.getItem("cart")) || [];
    let totalPrice = 0;

    // Initialize multi-item carousel
    function initializeCarousel() {
        const carousel = document.querySelector('#ramCarousel');
        if (carousel) {
            // Set up the carousel to show multiple items
            const items = document.querySelectorAll('.carousel-item');
            
            items.forEach((el) => {
                const minPerSlide = 3;
                let next = el.nextElementSibling;
                
                for (let i = 1; i < minPerSlide; i++) {
                    if (!next) {
                        // Wrap around by selecting first child
                        next = items[0];
                    }
                    
                    let cloneChild = next.cloneNode(true);
                    el.appendChild(cloneChild.children[0]);
                    next = next.nextElementSibling;
                }
            });

            // Initialize Bootstrap Carousel
            new bootstrap.Carousel(carousel, {
                interval: 3000, // 3 seconds
                ride: "carousel",
                wrap: true
            });

            // Add smooth scrolling behavior
            carousel.addEventListener("slid.bs.carousel", function () {
                carousel.querySelector(".carousel-inner").style.scrollBehavior = "smooth";
            });
        }
    }
    document.addEventListener("DOMContentLoaded", function () {
        let myCarousel = new bootstrap.Carousel(document.querySelector('#graphicsCarousel'), {
            interval: 3000, // Auto-slide every 3 seconds
            pause: "hover"
        });
    });
    
    // Call carousel initialization
    initializeCarousel();

    // Fetch Available Parts
    function loadParts() {
        $(".loading").show(); // Show loading indicator
        $.getJSON("/parts", function (data) {
            let partsList = $("#parts");
            partsList.empty();
            data.forEach(part => {
                let listItem = `
                    <li class="list-group-item d-flex justify-content-between align-items-center">
                        <span>${part.name} - ₹${part.price}</span>
                        <button class="btn btn-sm btn-primary add-to-cart-btn" data-name="${part.name}" data-price="${part.price}">➕ Add</button>
                    </li>`;
                partsList.append(listItem);
            });
            
            // Add event listeners to the new buttons
            $(".add-to-cart-btn").click(function() {
                const name = $(this).data('name');
                const price = parseFloat($(this).data('price'));
                addToCart(name, price);
            });
        }).fail(function () {
            alert("❌ Failed to load parts. Please try again.");
        }).always(function () {
            $(".loading").hide(); // Hide loading indicator
        });
    }

    // Add to Cart
    function addToCart(name, price) {
        let existingItem = cart.find(item => item.name === name);
        if (existingItem) {
            existingItem.quantity += 1;
        } else {
            cart.push({ name, price, quantity: 1 });
        }
        updateCart();
    }

    // Remove from Cart
    function removeFromCart(name) {
        cart = cart.filter(item => item.name !== name);
        updateCart();
    }

    // Update Cart
    function updateCart() {
        let selectedList = $("#selected");
        selectedList.empty();
        totalPrice = 0;

        if (cart.length === 0) {
            selectedList.append(`<li class="list-group-item text-center">🛒 Your cart is empty!</li>`);
        } else {
            cart.forEach(item => {
                totalPrice += item.price * item.quantity;
                selectedList.append(`
                    <li class="list-group-item d-flex justify-content-between align-items-center">
                        <span>${item.name} - ₹${item.price} x ${item.quantity}</span>
                        <div>
                            <button class="btn btn-sm btn-success increase-btn" data-name="${item.name}">➕</button>
                            <button class="btn btn-sm btn-warning decrease-btn" data-name="${item.name}">➖</button>
                            <button class="btn btn-sm btn-danger remove-btn" data-name="${item.name}">❌</button>
                        </div>
                    </li>`);
            });
            
            // Add event listeners to the new buttons
            $(".increase-btn").click(function() {
                updateQuantity($(this).data('name'), 1);
            });
            
            $(".decrease-btn").click(function() {
                updateQuantity($(this).data('name'), -1);
            });
            
            $(".remove-btn").click(function() {
                removeFromCart($(this).data('name'));
            });
        }

        $("#total-price").text(totalPrice.toFixed(2));

        // Save cart in Local Storage
        localStorage.setItem("cart", JSON.stringify(cart));
    }

    // Update Quantity
    function updateQuantity(name, change) {
        let item = cart.find(item => item.name === name);
        if (item) {
            item.quantity += change;
            if (item.quantity <= 0) {
                removeFromCart(name);
            } else {
                updateCart();
            }
        }
    }

    // Checkout
    $("#checkout-btn").click(function () {
        if (cart.length === 0) {
            alert("🛒 Your cart is empty!");
            return;
        }

        if (!confirm(`Confirm checkout for ₹${totalPrice.toFixed(2)}?`)) {
            return;
        }

        $(".loading").show(); // Show loading indicator
        $.ajax({
            url: "/assemble",
            method: "POST",
            contentType: "application/json",
            data: JSON.stringify({ parts: cart, total: totalPrice }),
            success: function (response) {
                alert(`🎉 ${response.message}`);
                cart = [];
                updateCart();
                localStorage.removeItem("cart"); // Clear Cart
            },
            error: function (xhr) {
                alert(`❌ Error: ${xhr.responseJSON?.error || "Processing order failed"}`);
            },
            complete: function () {
                $(".loading").hide(); // Hide loading indicator
            }
        });
    });

    // Dark Mode Toggle
    function toggleDarkMode() {
        $("body").toggleClass("dark-mode");
        let mode = $("body").hasClass("dark-mode") ? "enabled" : "disabled";
        localStorage.setItem("dark-mode", mode);
    }

    // Initialize dark mode
    if (localStorage.getItem("dark-mode") === "enabled") {
        $("body").addClass("dark-mode");
    }

    // Set up event listener
    $("#themeToggle").click(toggleDarkMode);

    // Initialize page
    loadParts(); // Load parts list
    updateCart(); // Load previous cart on page reload
});


document.addEventListener('DOMContentLoaded', function() {
    const wishlistButtons = document.querySelectorAll('.wishlist-btn');
    const wishlistToast = new bootstrap.Toast(document.getElementById('wishlistToast'));
    
    // Load wishlist from localStorage
    let wishlist = JSON.parse(localStorage.getItem('wishlist')) || [];
    
    // Initialize buttons
    wishlistButtons.forEach(button => {
        const pcId = button.getAttribute('data-pc-id');
        if (wishlist.some(item => item.id === pcId)) {
            const icon = button.querySelector('i');
            icon.classList.remove('far');
            icon.classList.add('fas', 'text-danger');
        }
    });
    
    // Handle wishlist button clicks
    wishlistButtons.forEach(button => {
        button.addEventListener('click', function() {
            const pcId = this.getAttribute('data-pc-id');
            const pcName = this.getAttribute('data-pc-name');
            const pcPrice = this.getAttribute('data-pc-price');
            const pcImage = this.getAttribute('data-pc-image');
            const icon = this.querySelector('i');
            
            if (icon.classList.contains('far')) {
                // Add to wishlist
                icon.classList.remove('far');
                icon.classList.add('fas', 'text-danger');
                addToWishlist(pcId, pcName, pcPrice, pcImage);
                showToast(`${pcName} added to wishlist`);
            } else {
                // Remove from wishlist
                icon.classList.remove('fas', 'text-danger');
                icon.classList.add('far');
                removeFromWishlist(pcId);
                showToast(`${pcName} removed from wishlist`);
            }
        });
    });
    
    function addToWishlist(id, name, price, image) {
        wishlist = wishlist.filter(item => item.id !== id); // Remove if already exists
        wishlist.push({ 
            id, 
            name, 
            price, 
            image,
            date: new Date().toISOString() 
        });
        localStorage.setItem('wishlist', JSON.stringify(wishlist));
    }
    
    function removeFromWishlist(id) {
        wishlist = wishlist.filter(item => item.id !== id);
        localStorage.setItem('wishlist', JSON.stringify(wishlist));
    }
    
    function showToast(message) {
        const toastBody = document.querySelector('.toast-body');
        toastBody.textContent = message;
        wishlistToast.show();
    }
    
    // View Wishlist Button (add this somewhere in your UI)
    const viewWishlistBtn = document.createElement('a');
    viewWishlistBtn.href = "{{ url_for('wishlist') }}";
    viewWishlistBtn.className = "btn btn-outline-danger position-fixed bottom-0 end-0 m-3";
    viewWishlistBtn.innerHTML = '<i class="fas fa-heart me-2"></i>View Wishlist';
    document.body.appendChild(viewWishlistBtn);
});