document.addEventListener('DOMContentLoaded', () => {
    const regionSelect = document.getElementById('region-select');
    const phoneNumberInput = document.getElementById('phone-number');

    // Set the initial placeholder to the default region (UK +44)
    phoneNumberInput.placeholder = regionSelect.value;

    // Update the placeholder when the region changes
    regionSelect.addEventListener('change', function() {
        const selectedDialCode = this.value;
        phoneNumberInput.value = "";  // Clear the input
        phoneNumberInput.placeholder = selectedDialCode;
    });

    // Ensure the input is added after the dialing code
    phoneNumberInput.addEventListener('input', function() {
        const selectedDialCode = regionSelect.value;
        const currentValue = this.value;

        // Ensure the input doesn't contain the dialing code
        if (!currentValue.startsWith(selectedDialCode)) {
            this.value = selectedDialCode + currentValue.replace(/^\+?\d+/, '');
        }
    });
});
