document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('recoveryForm');
    const emailInput = document.getElementById('email');
    const emailError = document.getElementById('emailError');
    const submitBtn = document.getElementById('submitBtn');
    const btnText = document.getElementById('btnText');
    const btnSpinner = document.getElementById('btnSpinner');
    const successMessage = document.getElementById('successMessage');
    
    // Email validation
    emailInput.addEventListener('input', function() {
        if(emailInput.validity.valid) {
            emailError.classList.add('hidden');
            emailInput.classList.remove('border-red-500');
            emailInput.classList.add('border-gray-300');
        }
    });
    
    // Form submission
    form.addEventListener('submit', function(e) {
        e.preventDefault();
        
        // Validate email
        if(!emailInput.validity.valid) {
            emailError.classList.remove('hidden');
            emailInput.classList.add('border-red-500');
            emailInput.classList.remove('border-gray-300');
            form.classList.add('shake');
            setTimeout(() => form.classList.remove('shake'), 500);
            return;
        }
        
        // Simulate API call
        submitBtn.disabled = true;
        btnText.textContent = 'Enviando...';
        btnSpinner.classList.remove('hidden');
        
        setTimeout(() => {
            // Show success message
            form.classList.add('hidden');
            successMessage.classList.remove('hidden');
            
            // Reset form
            setTimeout(() => {
                submitBtn.disabled = false;
                btnText.textContent = 'Enviar Instrucciones';
                btnSpinner.classList.add('hidden');
            }, 2000);
        }, 1500);
    });
    
    // Add floating label effect
    emailInput.addEventListener('focus', function() {
        emailInput.parentElement.querySelector('i').classList.add('text-purple-500');
    });
    
    emailInput.addEventListener('blur', function() {
        emailInput.parentElement.querySelector('i').classList.remove('text-purple-500');
    });
});