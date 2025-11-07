/**
 * Validation Helper - Utilidades para validación de formularios
 * Sistema de Compras Cielito Home
 */

window.ValidationHelper = {
    /**
     * Validar formulario completo
     * @param {HTMLFormElement} form - Elemento de formulario
     * @returns {Object} - {isValid: boolean, errors: array}
     */
    validateForm(form) {
        const errors = [];
        const inputs = form.querySelectorAll('[required], [data-validate]');

        inputs.forEach(input => {
            const validationResult = this.validateField(input);
            if (!validationResult.isValid) {
                errors.push({
                    field: input.name || input.id,
                    message: validationResult.message
                });
                this.showFieldError(input, validationResult.message);
            } else {
                this.clearFieldError(input);
            }
        });

        return {
            isValid: errors.length === 0,
            errors: errors
        };
    },

    /**
     * Validar un campo individual
     * @param {HTMLElement} field - Campo a validar
     * @returns {Object} - {isValid: boolean, message: string}
     */
    validateField(field) {
        const value = field.value.trim();
        const fieldName = field.getAttribute('data-label') || field.name || 'Este campo';

        // Required validation
        if (field.hasAttribute('required') && !value) {
            return {
                isValid: false,
                message: `${fieldName} es requerido`
            };
        }

        // Type-specific validations
        if (value) {
            switch (field.type) {
                case 'email':
                    if (!this.isValidEmail(value)) {
                        return {
                            isValid: false,
                            message: 'El formato del email no es válido'
                        };
                    }
                    break;

                case 'number':
                    const min = field.getAttribute('min');
                    const max = field.getAttribute('max');
                    const numValue = parseFloat(value);

                    if (isNaN(numValue)) {
                        return {
                            isValid: false,
                            message: `${fieldName} debe ser un número válido`
                        };
                    }

                    if (min !== null && numValue < parseFloat(min)) {
                        return {
                            isValid: false,
                            message: `${fieldName} debe ser mayor o igual a ${min}`
                        };
                    }

                    if (max !== null && numValue > parseFloat(max)) {
                        return {
                            isValid: false,
                            message: `${fieldName} debe ser menor o igual a ${max}`
                        };
                    }
                    break;

                case 'tel':
                    if (!this.isValidPhone(value)) {
                        return {
                            isValid: false,
                            message: 'El formato del teléfono no es válido'
                        };
                    }
                    break;

                case 'date':
                    if (!this.isValidDate(value)) {
                        return {
                            isValid: false,
                            message: 'La fecha no es válida'
                        };
                    }
                    break;
            }

            // Custom validations
            const validateType = field.getAttribute('data-validate');
            if (validateType) {
                switch (validateType) {
                    case 'rfc':
                        if (!this.isValidRFC(value)) {
                            return {
                                isValid: false,
                                message: 'El RFC no tiene un formato válido'
                            };
                        }
                        break;

                    case 'currency':
                        if (!this.isValidCurrency(value)) {
                            return {
                                isValid: false,
                                message: 'El monto no es válido'
                            };
                        }
                        break;

                    case 'future-date':
                        if (!this.isFutureDate(value)) {
                            return {
                                isValid: false,
                                message: 'La fecha debe ser futura'
                            };
                        }
                        break;

                    case 'past-date':
                        if (!this.isPastDate(value)) {
                            return {
                                isValid: false,
                                message: 'La fecha debe ser pasada'
                            };
                        }
                        break;
                }
            }

            // Min/Max length
            const minLength = field.getAttribute('minlength');
            const maxLength = field.getAttribute('maxlength');

            if (minLength && value.length < parseInt(minLength)) {
                return {
                    isValid: false,
                    message: `${fieldName} debe tener al menos ${minLength} caracteres`
                };
            }

            if (maxLength && value.length > parseInt(maxLength)) {
                return {
                    isValid: false,
                    message: `${fieldName} no puede exceder ${maxLength} caracteres`
                };
            }
        }

        return { isValid: true, message: '' };
    },

    /**
     * Mostrar error en campo
     */
    showFieldError(field, message) {
        field.classList.add('is-invalid');
        field.classList.remove('is-valid');

        // Buscar o crear div de feedback
        let feedback = field.nextElementSibling;
        if (!feedback || !feedback.classList.contains('invalid-feedback')) {
            feedback = document.createElement('div');
            feedback.className = 'invalid-feedback';
            field.parentNode.insertBefore(feedback, field.nextSibling);
        }
        feedback.textContent = message;
    },

    /**
     * Limpiar error de campo
     */
    clearFieldError(field) {
        field.classList.remove('is-invalid');
        const feedback = field.nextElementSibling;
        if (feedback && feedback.classList.contains('invalid-feedback')) {
            feedback.remove();
        }
    },

    /**
     * Marcar campo como válido
     */
    showFieldSuccess(field) {
        field.classList.add('is-valid');
        field.classList.remove('is-invalid');
    },

    /**
     * Validar email
     */
    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    },

    /**
     * Validar teléfono
     */
    isValidPhone(phone) {
        // Acepta formatos: 1234567890, 123-456-7890, (123) 456-7890, etc.
        const phoneRegex = /^[\d\s\-\(\)]+$/;
        const digitsOnly = phone.replace(/\D/g, '');
        return phoneRegex.test(phone) && digitsOnly.length === 10;
    },

    /**
     * Validar RFC
     */
    isValidRFC(rfc) {
        // Persona Física: 13 caracteres
        // Persona Moral: 12 caracteres
        const rfcRegex = /^[A-ZÑ&]{3,4}\d{6}[A-V1-9][A-Z1-9][0-9A]$/;
        return rfcRegex.test(rfc.toUpperCase());
    },

    /**
     * Validar moneda
     */
    isValidCurrency(amount) {
        const currencyRegex = /^\d+(\.\d{1,2})?$/;
        return currencyRegex.test(amount) && parseFloat(amount) >= 0;
    },

    /**
     * Validar fecha
     */
    isValidDate(dateString) {
        const date = new Date(dateString);
        return date instanceof Date && !isNaN(date);
    },

    /**
     * Verificar si es fecha futura
     */
    isFutureDate(dateString) {
        const date = new Date(dateString);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return date >= today;
    },

    /**
     * Verificar si es fecha pasada
     */
    isPastDate(dateString) {
        const date = new Date(dateString);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return date < today;
    },

    /**
     * Agregar contador de caracteres a textarea
     */
    addCharCounter(textarea) {
        const maxLength = textarea.getAttribute('maxlength');
        if (!maxLength) return;

        const counter = document.createElement('div');
        counter.className = 'char-counter';
        textarea.parentNode.appendChild(counter);

        const updateCounter = () => {
            const current = textarea.value.length;
            const max = parseInt(maxLength);
            const remaining = max - current;

            counter.textContent = `${current} / ${max} caracteres`;

            if (remaining < 20) {
                counter.classList.add('danger');
                counter.classList.remove('warning');
            } else if (remaining < 50) {
                counter.classList.add('warning');
                counter.classList.remove('danger');
            } else {
                counter.classList.remove('warning', 'danger');
            }
        };

        textarea.addEventListener('input', updateCounter);
        updateCounter();
    },

    /**
     * Validación en tiempo real
     */
    enableRealTimeValidation(form) {
        const inputs = form.querySelectorAll('[required], [data-validate]');

        inputs.forEach(input => {
            input.addEventListener('blur', () => {
                const result = this.validateField(input);
                if (!result.isValid) {
                    this.showFieldError(input, result.message);
                } else {
                    this.clearFieldError(input);
                    if (input.value.trim()) {
                        this.showFieldSuccess(input);
                    }
                }
            });

            input.addEventListener('input', () => {
                if (input.classList.contains('is-invalid')) {
                    const result = this.validateField(input);
                    if (result.isValid) {
                        this.clearFieldError(input);
                        this.showFieldSuccess(input);
                    }
                }
            });
        });

        // Agregar contadores de caracteres a textareas
        form.querySelectorAll('textarea[maxlength]').forEach(textarea => {
            this.addCharCounter(textarea);
        });
    },

    /**
     * Prevenir envío de formulario inválido
     */
    preventInvalidSubmit(form) {
        form.addEventListener('submit', (e) => {
            const validation = this.validateForm(form);

            if (!validation.isValid) {
                e.preventDefault();
                e.stopPropagation();

                // Scroll al primer error
                const firstInvalid = form.querySelector('.is-invalid');
                if (firstInvalid) {
                    firstInvalid.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    firstInvalid.focus();
                }

                // Mostrar toast con resumen de errores
                if (typeof Utils !== 'undefined') {
                    Utils.showToast(
                        `Por favor corrige ${validation.errors.length} error(es) en el formulario`,
                        'error'
                    );
                }
            }
        });
    },

    /**
     * Inicializar validaciones completas en un formulario
     */
    init(form) {
        if (!form) return;

        this.enableRealTimeValidation(form);
        this.preventInvalidSubmit(form);

        // Marcar labels requeridos
        form.querySelectorAll('[required]').forEach(input => {
            const label = form.querySelector(`label[for="${input.id}"]`);
            if (label && !label.classList.contains('required')) {
                label.classList.add('required');
            }
        });
    },

    /**
     * Validar rango de fechas
     */
    validateDateRange(startDate, endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);

        if (start > end) {
            return {
                isValid: false,
                message: 'La fecha de inicio debe ser anterior a la fecha de fin'
            };
        }

        return { isValid: true, message: '' };
    },

    /**
     * Resetear validaciones de formulario
     */
    reset(form) {
        form.querySelectorAll('.is-invalid, .is-valid').forEach(field => {
            field.classList.remove('is-invalid', 'is-valid');
        });

        form.querySelectorAll('.invalid-feedback, .valid-feedback').forEach(feedback => {
            feedback.remove();
        });
    }
};

// Auto-inicializar validaciones en formularios con data-validate-form
document.addEventListener('DOMContentLoaded', function() {
    document.querySelectorAll('[data-validate-form]').forEach(form => {
        ValidationHelper.init(form);
    });
});
