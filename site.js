// Mobile-friendly reveal + contact form mailto fallback
document.querySelectorAll('.reveal').forEach(el => el.classList.add('reveal-init'));
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      observer.unobserve(entry.target);
    }
  });
}, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });
document.querySelectorAll('.reveal').forEach(el => observer.observe(el));

const form = document.getElementById('contactForm');
if (form) {
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const msg = document.getElementById('formMsg');
    let valid = true;
    [...form.elements].forEach(el => {
      if (!el.willValidate) return;
      const ok = el.checkValidity();
      el.style.borderColor = ok ? '' : 'rgba(139,0,0,0.8)';
      if (!ok) valid = false;
    });
    if (msg) msg.hidden = false;
    if (!valid) {
      if (msg) {
        msg.textContent = 'Please fill out the highlighted fields.';
        msg.classList.remove('ok');
      }
      form.reportValidity();
      return;
    }
    const data = new FormData(form);
    const subject = encodeURIComponent(`Made by Lumi inquiry — ${data.get('type') || 'general'}`);
    const body = encodeURIComponent(
      `Name: ${data.get('name')}\nEmail: ${data.get('email')}\nInterest: ${data.get('type')}\n\n${data.get('message')}`
    );
    if (msg) {
      msg.textContent = 'Opening your email… If nothing opens, write chris@madebylumi.com.';
      msg.classList.add('ok');
    }
    window.location.href = `mailto:chris@madebylumi.com?subject=${subject}&body=${body}`;
  });
}
