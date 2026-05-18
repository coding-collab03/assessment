async function check() {
  try {
    const r1 = await fetch('http://localhost:5173');
    console.log('frontend', r1.status);
  } catch (e) {
    console.error('frontend error', e.message);
  }
  try {
    const r2 = await fetch('http://localhost:3001');
    console.log('backend', r2.status);
  } catch (e) {
    console.error('backend error', e.message);
  }
}

check();
