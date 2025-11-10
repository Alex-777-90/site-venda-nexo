  const form = document.getElementById('loginForm');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value.trim();
    const senha = document.getElementById('senha').value.trim();

    const resp = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, password: senha })
    });

    const data = await resp.json();
    if (!resp.ok) {
      if (data.error === 'BAD_PASSWORD') location.href = '/error-401';
      else if (data.error === 'USER_NOT_FOUND') location.href = '/error-404';
      else alert('Falha no login');
      return;
    }
    // redireciona conforme o papel
    if (data.user.role === 'admin') location.href = '/';
    else location.href = '/';
  });