document.getElementById('login-btn').addEventListener('click', async function () {
    const email = document.getElementById('username').value.trim().toLowerCase();
    const password = document.getElementById('password').value;
    
    try {
        console.log("Enviando a /auth:", { email, password });

        const response = await fetch('/auth', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
    
        const result = await response.json();
    
        if (response.ok) {
            // Guardar token en localStorage
            localStorage.setItem('token', result.token);
            
            // Guardar token en cookie (expira en 24 horas)
            document.cookie = `token=${result.token}; path=/; max-age=86400; SameSite=Strict`;
            
            // Redireccionar con el token como parámetro de consulta
            window.location.href = `/dashboard`;
        } else {
            alert(result.message || 'Error de autenticación');
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Error al conectar con el servidor');
    }
});