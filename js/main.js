// Initialisation des animations AOS
AOS.init({
    duration: 800,
    easing: 'ease',
    once: true,
    offset: 50
});

// Smooth scrolling pour la navigation
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        const headerOffset = 100;
        const elementPosition = target.getBoundingClientRect().top;
        const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

        window.scrollTo({
            top: offsetPosition,
            behavior: 'smooth'
        });
    });
});

// Navbar changement de style au défilement
const navbar = document.querySelector('.navbar');
let lastScrollTop = 0;

window.addEventListener('scroll', () => {
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    
    if (scrollTop > 50) {
        navbar.classList.add('scrolled');
    } else {
        navbar.classList.remove('scrolled');
    }

    // Cache/montre la navbar selon la direction du scroll
    if (scrollTop > lastScrollTop) {
        navbar.style.transform = 'translateY(-100%)';
    } else {
        navbar.style.transform = 'translateY(0)';
    }
    lastScrollTop = scrollTop;
});

// Animation du texte de la hero section
const heroTitle = document.querySelector('.hero h1');
const heroText = document.querySelector('.hero .lead');

if (heroTitle && heroText) {
    setTimeout(() => {
        heroTitle.style.opacity = '1';
        heroTitle.style.transform = 'translateY(0)';
    }, 500);

    setTimeout(() => {
        heroText.style.opacity = '1';
        heroText.style.transform = 'translateY(0)';
    }, 800);
}

// Initialisation d'EmailJS
(function() {
    try {
        emailjs.init("eMocqnQx1z-onB4oP");
        console.log('EmailJS initialisé avec succès');
    } catch (error) {
        console.error('Erreur lors de l\'initialisation d\'EmailJS:', error);
    }
})();

// Gestion du formulaire de contact avec validation et envoi d'email
const contactForm = document.getElementById('contact-form');

if (contactForm) {
    contactForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        // Validation des champs
        let isValid = true;
        const formInputs = this.querySelectorAll('input, textarea');
        const formData = {};
        
        formInputs.forEach(input => {
            if (input.required && !input.value.trim()) {
                isValid = false;
                input.classList.add('is-invalid');
            } else {
                input.classList.remove('is-invalid');
                formData[input.name] = input.value;
            }
            
            // Validation spécifique pour l'email
            if (input.type === 'email' && input.value) {
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(input.value)) {
                    isValid = false;
                    input.classList.add('is-invalid');
                }
            }
        });

        if (isValid) {
            // Animation de chargement
            const submitBtn = this.querySelector('button[type="submit"]');
            const originalText = submitBtn.innerHTML;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Envoi en cours...';
            submitBtn.disabled = true;

            // Envoi de l'email via EmailJS
            console.log('Tentative d\'envoi d\'email avec les données:', {
                to_name: 'Chayma',
                from_name: formData.name,
                from_email: formData.email,
                phone_number: formData.phone || 'Non renseigné',
                message: formData.message,
                reply_to: formData.email
            });

            emailjs.send('service_2hr4m58', 'template_9ayjvqa', {
                to_name: 'Chayma',
                from_name: formData.name,
                from_email: formData.email,
                phone_number: formData.phone || 'Non renseigné',
                message: formData.message,
                reply_to: formData.email
            })
            .then((response) => {
                console.log('Email envoyé avec succès:', response);

                // Message de succès
                const successMessage = document.createElement('div');
                successMessage.className = 'alert alert-success mt-3';
                successMessage.innerHTML = '<i class="fas fa-check-circle"></i> Merci pour votre message. Je vous recontacterai dans les plus brefs délais.';
                this.appendChild(successMessage);

                // Réinitialisation du formulaire
                this.reset();
                submitBtn.innerHTML = originalText;
                submitBtn.disabled = false;

                // Suppression du message après 5 secondes
                setTimeout(() => {
                    successMessage.remove();
                }, 5000);
            })
            .catch(error => {
                // Message d'erreur
                const errorMessage = document.createElement('div');
                errorMessage.className = 'alert alert-danger mt-3';
                errorMessage.innerHTML = '<i class="fas fa-exclamation-circle"></i> Une erreur est survenue lors de l\'envoi du message. Veuillez réessayer.';
                this.appendChild(errorMessage);
                
                submitBtn.innerHTML = originalText;
                submitBtn.disabled = false;
                
                console.error('Erreur EmailJS:', error);
            });
        }
    });

    // Validation en temps réel
    contactForm.querySelectorAll('input, textarea').forEach(input => {
        input.addEventListener('input', function() {
            if (this.required && this.value.trim()) {
                this.classList.remove('is-invalid');
            }
        });
    });
}

// Animation des cartes au survol
document.querySelectorAll('.approach-card, .blog-card').forEach(card => {
    card.addEventListener('mouseenter', function() {
        this.style.transform = 'translateY(-10px)';
        this.style.boxShadow = '0 15px 30px rgba(0, 0, 0, 0.1)';
    });

    card.addEventListener('mouseleave', function() {
        this.style.transform = 'translateY(0)';
        this.style.boxShadow = '0 5px 15px rgba(0, 0, 0, 0.1)';
    });
});

// Initialisation de la carte Google Maps
function initMap() {
    try {
        // Coordonnées de Bagnols-sur-Cèze
        const cabinetLocation = { lat: 44.1628, lng: 4.6201 };
        
        const map = new google.maps.Map(document.getElementById('map'), {
            zoom: 15,
            center: cabinetLocation,
            styles: [
                {
                    "featureType": "water",
                    "elementType": "geometry",
                    "stylers": [{"color": "#e9e9e9"}, {"lightness": 17}]
                },
                {
                    "featureType": "landscape",
                    "elementType": "geometry",
                    "stylers": [{"color": "#f5f5f5"}, {"lightness": 20}]
                },
                {
                    "featureType": "road.highway",
                    "elementType": "geometry.fill",
                    "stylers": [{"color": "#ffffff"}, {"lightness": 17}]
                },
                {
                    "featureType": "road.highway",
                    "elementType": "geometry.stroke",
                    "stylers": [{"color": "#ffffff"}, {"lightness": 29}, {"weight": 0.2}]
                },
                {
                    "featureType": "road.arterial",
                    "elementType": "geometry",
                    "stylers": [{"color": "#ffffff"}, {"lightness": 18}]
                },
                {
                    "featureType": "road.local",
                    "elementType": "geometry",
                    "stylers": [{"color": "#ffffff"}, {"lightness": 16}]
                },
                {
                    "featureType": "poi",
                    "elementType": "geometry",
                    "stylers": [{"color": "#f5f5f5"}, {"lightness": 21}]
                },
                {
                    "featureType": "poi.park",
                    "elementType": "geometry",
                    "stylers": [{"color": "#dedede"}, {"lightness": 21}]
                }
            ]
        });

        const marker = new google.maps.Marker({
            position: cabinetLocation,
            map: map,
            title: 'Cabinet de Psychologie - Chayma Dahmani',
            icon: {
                path: google.maps.SymbolPath.CIRCLE,
                scale: 10,
                fillColor: '#9B8579',
                fillOpacity: 1,
                strokeColor: '#ffffff',
                strokeWeight: 2
            }
        });
    } catch (error) {
        console.error('Erreur lors de l\'initialisation de la carte:', error);
        const mapElement = document.getElementById('map');
        if (mapElement) {
            mapElement.innerHTML = '<div class="alert alert-warning">La carte est temporairement indisponible. Veuillez réessayer plus tard.</div>';
        }
    }
}

// Chargement asynchrone de Google Maps
function loadGoogleMaps() {
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=AIzaSyBnLWWh7B1lD_GWAEq2--IhMPqntQ4iirI&callback=initMap`;
    script.async = true;
    script.defer = true;
    script.onerror = function() {
        const mapElement = document.getElementById('map');
        if (mapElement) {
            mapElement.innerHTML = '<div class="alert alert-warning">La carte est temporairement indisponible. Veuillez réessayer plus tard.</div>';
        }
    };
    document.head.appendChild(script);
}

// Chargement de la carte une fois que la page est chargée
window.addEventListener('load', loadGoogleMaps);
