document.addEventListener('DOMContentLoaded', function() {
    console.log('Login page cargada');

    // Verificar si ya está autenticado
    if (localStorage.getItem('token')) {
        console.log('Usuario ya autenticado, redirigiendo...');
        window.location.href = 'dashboard.html';
        return;
    }

    // Elementos del DOM
    const loginForm = document.getElementById('loginForm');
    const loginAlert = document.getElementById('loginAlert');
    const loginErrorMessage = document.getElementById('loginErrorMessage');
    const loginBtn = document.getElementById('loginBtn');
    const togglePassword = document.getElementById('togglePassword');
    const passwordInput = document.getElementById('password');
    const emailInput = document.getElementById('email');
    const rememberMeCheckbox = document.getElementById('rememberMe');

    // Cargar email recordado si existe
    const savedEmail = localStorage.getItem('rememberedEmail');
    if (savedEmail && emailInput) {
        emailInput.value = savedEmail;
        if (rememberMeCheckbox) {
            rememberMeCheckbox.checked = true;
        }
    }

    // Función para validar email
    function isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    // Mostrar usuarios de prueba (deshabilitado en producción)
    // showTestUsers();

    // Toggle contraseña
    if (togglePassword && passwordInput) {
        togglePassword.addEventListener('click', function() {
            const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
            passwordInput.setAttribute('type', type);
            
            const icon = this.querySelector('i');
            if (icon) {
                icon.classList.toggle('fa-eye');
                icon.classList.toggle('fa-eye-slash');
            }
        });
    }

    // Manejar envío del formulario
    if (loginForm) {
        loginForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            console.log('Formulario enviado');
            
            const formData = new FormData(this);
            const email = formData.get('email');
            const password = formData.get('password');

            // Validaciones
            if (!email || !password) {
                showAlert('Por favor, completa todos los campos');
                return;
            }

            if (!isValidEmail(email)) {
                showAlert('Email inválido');
                return;
            }

            try {
                setLoginButtonState(true);
                hideAlert();

                console.log('Enviando login para:', email);
                console.log('URL API:', CONFIG.API_URL);

                // Hacer petición directa
                const response = await fetch(`${CONFIG.API_URL}/auth/login`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ email, password })
                });

                console.log('Response status:', response.status);

                if (!response.ok) {
                    // Intentar parsear la respuesta JSON del backend
                    try {
                        const errorData = await response.json();
                        console.error('Error response:', errorData);

                        // El backend envía el mensaje en errorData.message
                        const errorMessage = errorData.message || 'Error en el inicio de sesión';
                        throw new Error(errorMessage);
                    } catch (parseError) {
                        // Si no se puede parsear el JSON, mostrar mensaje genérico amigable
                        console.error('Error al parsear respuesta:', parseError);

                        // Mensajes amigables según el código de estado
                        let friendlyMessage = 'Error de conexión con el servidor';

                        switch(response.status) {
                            case 400:
                                friendlyMessage = 'Por favor verifica que los datos sean correctos';
                                break;
                            case 401:
                                friendlyMessage = 'Usuario o contraseña incorrectos';
                                break;
                            case 404:
                                friendlyMessage = 'Servicio no disponible. Contacta al administrador';
                                break;
                            case 429:
                                friendlyMessage = 'Demasiados intentos de inicio de sesión. Por favor espera 5 minutos e intenta nuevamente.';
                                break;
                            case 500:
                                friendlyMessage = 'Error del servidor. Intenta nuevamente más tarde';
                                break;
                        }

                        throw new Error(friendlyMessage);
                    }
                }

                const data = await response.json();
                console.log('Login response:', data);

                if (data.success) {
                    console.log('Login exitoso');

                    // Guardar datos
                    localStorage.setItem('token', data.data.token);
                    localStorage.setItem('user', JSON.stringify(data.data.user));

                    // Guardar o eliminar email recordado según el checkbox
                    if (rememberMeCheckbox && rememberMeCheckbox.checked) {
                        localStorage.setItem('rememberedEmail', email);
                    } else {
                        localStorage.removeItem('rememberedEmail');
                    }

                    // Mostrar éxito y redirigir
                    showSuccessAlert('¡Login exitoso! Redirigiendo...');

                    // Redirigir después de 1 segundo
                    setTimeout(() => {
                        console.log('Redirigiendo a dashboard...');
                        window.location.href = 'dashboard.html';
                    }, 1000);

                } else {
                    throw new Error(data.error || 'Error en login');
                }

            } catch (error) {
                console.error('Login error:', error);
                showAlert(error.message || 'Error de conexión');
            } finally {
                setLoginButtonState(false);
            }
        });
    }

    // Funciones auxiliares
    function showAlert(message) {
        if (loginErrorMessage && loginAlert) {
            loginErrorMessage.textContent = message;
            loginAlert.classList.remove('d-none', 'alert-success-modern');
            loginAlert.classList.add('alert-danger-modern');
        }
    }

    function showSuccessAlert(message) {
        if (loginErrorMessage && loginAlert) {
            loginErrorMessage.textContent = message;
            loginAlert.classList.remove('d-none', 'alert-danger-modern');
            loginAlert.classList.add('alert-success-modern');
        }
    }

    function hideAlert() {
        if (loginAlert) {
            loginAlert.classList.add('d-none');
        }
    }

    function setLoginButtonState(loading) {
        if (!loginBtn) return;
        
        if (loading) {
            loginBtn.disabled = true;
            loginBtn.innerHTML = `
                <span class="spinner-border spinner-border-sm me-2"></span>
                Iniciando sesión...
            `;
        } else {
            loginBtn.disabled = false;
            loginBtn.innerHTML = `
                <i class="fas fa-sign-in-alt me-2"></i>
                Iniciar Sesión
            `;
        }
    }

    function showTestUsers() {
        // FUNCIÓN DESHABILITADA POR SEGURIDAD
        // No mostrar usuarios de prueba en producción
        // Credenciales de prueba eliminadas
        console.log('Test users disabled for security');
    }

    // Funcionalidad "Olvidé mi contraseña" - Modal informativo
    const forgotPasswordLink = document.getElementById('forgotPasswordLink');

    if (forgotPasswordLink) {
        forgotPasswordLink.addEventListener('click', function(e) {
            e.preventDefault();
            const forgotPasswordModal = new bootstrap.Modal(document.getElementById('forgotPasswordModal'));
            forgotPasswordModal.show();
        });
    }

    // Auto-focus
    if (emailInput) {
        emailInput.focus();
    }
}); 