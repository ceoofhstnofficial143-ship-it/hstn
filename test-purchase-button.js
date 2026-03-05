// Test script to verify SimplePurchaseRequestButton integration
// Run this in browser console on any product page

console.log('=== Testing Purchase Request Button ===');

// Check if SimplePurchaseRequestButton is available
if (typeof SimplePurchaseRequestButton !== 'undefined') {
    console.log('✅ SimplePurchaseRequestButton component is available');
} else {
    console.log('❌ SimplePurchaseRequestButton component is NOT available');
}

// Check if it's imported in ProductCard
const productCards = document.querySelectorAll('[data-component-name="ProductCard"]');
console.log(`Found ${productCards.length} ProductCard components`);

// Check for request buttons
const requestButtons = document.querySelectorAll('button');
console.log(`Found ${requestButtons.length} buttons on page`);

// Look for purchase request functionality
const purchaseButtons = Array.from(requestButtons).filter(btn => 
    btn.textContent?.includes('Request') || 
    btn.textContent?.includes('Purchase')
);

console.log(`Found ${purchaseButtons.length} potential purchase buttons:`, purchaseButtons.map(btn => btn.textContent));

// Check for any error messages
const errorElements = document.querySelectorAll('.text-red-500, .text-red-600');
if (errorElements.length > 0) {
    console.log('❌ Found error elements:', errorElements);
}

console.log('=== Test Complete ===');
