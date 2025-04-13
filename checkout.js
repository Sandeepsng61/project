$(document).ready(function () {
    let cart = JSON.parse(localStorage.getItem("cart")) || [];
    let totalPrice = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

    // Redirect if cart is empty
    if (cart.length === 0) {
        alert("🛒 Your cart is empty! Redirecting to Home...");
        window.location.href = "/";
    }

    // Display Total Price
    $("#total-price").text(totalPrice);

    // Display Order Summary
    cart.forEach(item => {
        $("#order-summary").append(`
            <li class="list-group-item d-flex justify-content-between align-items-center">
                <span>${item.name} (x${item.quantity})</span>
                <strong>₹${item.price * item.quantity}</strong>
            </li>
        `);
    });

    // Enable/Disable Confirm Order Button Based on Input
    $(".checkout-input").on("input", function () {
        let name = $("#customerName").val().trim();
        let email = $("#customerEmail").val().trim();
        let address = $("#customerAddress").val().trim();
        let payment = $("#paymentMethod").val();

        let isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email); // Basic email validation
        $("#confirmOrderBtn").prop("disabled", !(name && isEmailValid && address && payment));
    });

    // Confirm Order
    $("#confirmOrderBtn").click(function () {
        let name = $("#customerName").val().trim();
        let email = $("#customerEmail").val().trim();
        let address = $("#customerAddress").val().trim();
        let payment = $("#paymentMethod").val();

        if (!name || !email || !address || !payment) {
            alert("⚠️ Please fill all details and select a payment method!");
            return;
        }

        let orderData = {
            customer: { name, email, address, payment },
            items: cart,
            total: totalPrice,
        };

        $("#confirmOrderBtn").prop("disabled", true).text("⏳ Processing...");
        $(".loading").show(); // Show loading indicator

        $.ajax({
            url: "/checkout",
            method: "POST",
            contentType: "application/json",
            data: JSON.stringify(orderData),
            success: function (response) {
                alert(`🎉 ${response.message}\nOrder ID: ${response.orderId}`);
                localStorage.removeItem("cart");
                window.location.href = "/order-confirmation"; // Redirect to confirmation page
            },
            error: function (xhr) {
                let errorMessage = "❌ Error processing order. Please try again!";
                if (xhr.responseJSON && xhr.responseJSON.message) {
                    errorMessage = xhr.responseJSON.message;
                }
                alert(errorMessage);
                $("#confirmOrderBtn").prop("disabled", false).text("✅ Confirm Order");
            },
            complete: function () {
                $(".loading").hide(); // Hide loading indicator
            }
        });
    });

    // Dark Mode Toggle with Local Storage
    if (localStorage.getItem("dark-mode") === "enabled") {
        $("body").addClass("dark-mode");
    }

    $("#themeToggle").click(function () {
        $("body").toggleClass("dark-mode");
        let mode = $("body").hasClass("dark-mode") ? "enabled" : "disabled";
        localStorage.setItem("dark-mode", mode);
    });
});