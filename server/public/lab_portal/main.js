function getAuthToken(){
  return localStorage.getItem('lab_token');
}

async function api(path, opts={}){
  const headers = { 'Content-Type': 'application/json' };
  const token = getAuthToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(path, { headers, ...opts });
  if (res.status === 401) {
    // token invalid/expired — clear and prompt login
    localStorage.removeItem('lab_token');
    throw new Error('Invalid or expired token');
  }
  if (!res.ok) {
    const body = await res.json().catch(()=>({}));
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  return res.json();
}

function q(sel){ return document.querySelector(sel); }

async function loadLabs(){
  const labs = await api('/api/labs');
  const labList = q('#labs');
  labList.innerHTML = '';
  for(const l of labs){
    const li = document.createElement('li');
    const a = document.createElement('a');
    a.href = `${location.pathname}?lab_id=${l.id}`;
    a.textContent = `${l.name} (${l.contact_info || ''})`;
    li.appendChild(a);
    labList.appendChild(li);
  }
  q('#labs-list').classList.remove('hidden');
}

function getQuery(){
  return new URLSearchParams(location.search);
}

async function loadNotifications(labId){
  try{
    const resp = await api(`/api/labs/${labId}/notifications`);
    const el = q('#notifications');
    el.innerHTML = '';
    if (!resp || !resp.notifications || resp.notifications.length===0) {
      el.innerHTML = '<p>No notifications</p>';
      return;
    }
    for(const n of resp.notifications){
      const li = document.createElement('div');
      li.className = 'notif';
      let payload = n.payload_json;
      try{ payload = JSON.parse(payload); }catch(e){ }
      li.innerHTML = `<div><strong>${n.type}</strong> — ${payload && payload.preview ? payload.preview : JSON.stringify(payload)}</div><div class="time">${n.created_at}</div>`;
      el.appendChild(li);
    }
  }catch(e){ console.error('Failed to load notifications', e); }
}

async function loadAssignments(labId){
  const el = q('#assignments');
  el.innerHTML = '<p>Loading…</p>';
  const rows = await api(`/api/labs/${labId}/assignments`);
  el.innerHTML = '';
  if (!rows || rows.length===0) {
    el.innerHTML = '<p>No assignments found.</p>';
    return;
  }
  for(const a of rows){
    const card = document.createElement('div');
    card.className = 'card';
    const content = (function(){
      try{ const parsed = JSON.parse(a.message_content || '{}'); return parsed; }catch(e){ return null; }
    })();
    card.innerHTML = `
      <h3>Assignment #${a.id} — ${a.user_name || 'Unknown patient'}</h3>
      <p><strong>Therapist:</strong> ${a.therapist_name || 'N/A'}</p>
      <p><strong>Status:</strong> ${a.status}</p>
      <p><strong>Assigned:</strong> ${a.assigned_at || ''}</p>
      <div class="exam">
        <pre>${a.message_content || ''}</pre>
      </div>
    `;
    

    const actions = document.createElement('div');
    actions.className = 'actions';
    const acceptBtn = document.createElement('button');
    acceptBtn.textContent = 'Accept';
    if (String(a.status).toLowerCase() !== 'pending') {
      acceptBtn.disabled = true;
    }
    acceptBtn.onclick = async ()=>{
      if (acceptBtn.disabled) return;
      acceptBtn.disabled = true;
      acceptBtn.textContent = 'Accepting…';
      try {
        await api(`/api/labs/assignments/${a.id}/accept`, { method: 'POST' });
        // refresh assignments and notifications
        await loadAssignments(labId);
        await loadNotifications(labId);
      } catch (err) {
        console.error('Failed to accept assignment', err);
        alert('Failed to accept assignment: ' + (err.message || err));
        acceptBtn.disabled = false;
        acceptBtn.textContent = 'Accept';
      }
    };
    actions.appendChild(acceptBtn);

    const resultBtn = document.createElement('button');
    resultBtn.textContent = 'Submit Result';
    resultBtn.onclick = ()=> openResultForm(a.id, card, labId, a);
    actions.appendChild(resultBtn);

    card.appendChild(actions);
    el.appendChild(card);
  }
}

function openResultForm(assignmentId, parent, labId, assignment){
  // prevent duplicate
  if (parent.querySelector('.result-form')) return;
  const form = document.createElement('div');
  form.className = 'result-form';
  form.innerHTML = `
    <h4>Upload Result for assignment ${assignmentId}</h4>
    <label>Result (JSON or text):</label>
    <textarea class="result-json" rows="6">{"notes":"Result notes","values":{}}</textarea>
    <label>Attachment (optional):</label>
    <input type="file" class="result-file" />
    <div class="form-actions">
      <button class="send">Send Result</button>
      <button class="cancel">Cancel</button>
    </div>
  `;
  parent.appendChild(form);
  form.querySelector('.cancel').onclick = ()=> form.remove();
  form.querySelector('.send').onclick = async ()=>{
    const btn = form.querySelector('.send');
    const val = form.querySelector('.result-json').value;
    btn.disabled = true;
    btn.textContent = 'Sending…';
    try{
      // prepare payload
      const payload = { result_json: val, uploaded_by: 'lab-'+labId };
      const fileInput = form.querySelector('.result-file');
      if (fileInput && fileInput.files && fileInput.files.length) {
        const file = fileInput.files[0];
        const dataUrl = await new Promise((resolve, reject) => {
          const fr = new FileReader();
          fr.onload = () => resolve(fr.result);
          fr.onerror = () => reject(new Error('Failed to read file'));
          fr.readAsDataURL(file);
        });
        // dataUrl like: data:<mime>;base64,AAAA
        const parts = dataUrl.split(',');
        const base64 = parts[1];
        payload.attachment_name = file.name;
        payload.attachment_mime = file.type || '';
        payload.attachment_base64 = base64;
      }
      const res = await api(`/api/labs/assignments/${assignmentId}/results`, { method: 'POST', body: JSON.stringify(payload) });
      alert('Result submitted');
      form.remove();
      await loadAssignments(labId);
      await loadNotifications(labId);
    }catch(e){
      console.error('Failed to submit result', e);
      alert('Failed to submit result: ' + (e.message || e));
      btn.disabled = false;
      btn.textContent = 'Send Result';
    }
  };
}

(async function main(){
  const params = getQuery();
  const paramLabId = params.get('lab_id');
  // fetch labs to know seeded emails and lab metadata
  let labs = [];
  try { labs = await api('/api/labs'); } catch(e){ console.warn('Could not fetch labs list', e); labs = []; }
  // find selected lab if provided (used only to prefill the email field)
  const selectedLab = paramLabId ? labs.find(l => String(l.id) === String(paramLabId)) : null;

  const token = getAuthToken();
  // ensure login section visible by default
  q('#login-section').classList.remove('hidden');
  q('#assignments-section').classList.add('hidden');

  // Prefill email when we have lab info
  if (selectedLab && selectedLab.contact_info) {
    const emailEl = document.getElementById('lab-email'); if (emailEl) emailEl.value = selectedLab.contact_info;
  }

  q('#login-btn').onclick = async ()=>{
    const email = (document.getElementById('lab-email').value || '').trim();
    const pass = document.getElementById('lab-pass').value || '';
    q('#login-error').textContent = '';
    if (!email) { q('#login-error').textContent = 'Email is required'; return; }
    if (!pass) { q('#login-error').textContent = 'Password is required'; return; }
    try {
      // lookup lab id by email (contact_info)
      const labsList = labs.length ? labs : await api('/api/labs');
      const match = labsList.find(l => String(l.contact_info).toLowerCase() === String(email).toLowerCase() || String(l.name).toLowerCase() === String(email).toLowerCase());
      if (!match) { q('#login-error').textContent = 'Lab not found for that email'; return; }
      const id = match.id;
      const resp = await fetch('/api/labs/login', { method: 'POST', headers: { 'Content-Type':'application/json' }, body: JSON.stringify({ lab_id: id, password: pass }) });
      const body = await resp.json();
      if (!resp.ok) { q('#login-error').textContent = body.error || 'Login failed'; return; }
      localStorage.setItem('lab_token', body.token);
      // show brief success flash, then redirect to dashboard (?lab_id=)
      const successEl = q('#login-success');
      if (successEl) {
        successEl.textContent = 'Login successful — redirecting…';
        successEl.classList.remove('hidden');
        successEl.classList.add('success');
      }
      // small delay so user sees the flash
      setTimeout(()=>{ location.href = `${location.pathname}?lab_id=${id}`; }, 700);
    } catch (e) { q('#login-error').textContent = e.message || 'Login error'; }
  };

  // if token exists, try to load assignments for the selected lab id
  if (token && selectedLab) {
    q('#login-section').classList.add('hidden');
    q('#assignments-section').classList.remove('hidden');
    q('#logout-btn').classList.remove('hidden');
    // reveal lab-info for authenticated session
    q('#lab-info').textContent = `${selectedLab.name} — ${selectedLab.contact_info || ''}`;
    q('#lab-info').classList.remove('hidden');
    await loadAssignments(selectedLab.id);
    setInterval(()=>{ loadAssignments(selectedLab.id); loadNotifications(selectedLab.id); }, 10000);
  }
})();

// Logout handler
document.addEventListener('click', (e)=>{
  if (e.target && e.target.id === 'logout-btn'){
    localStorage.removeItem('lab_token');
    location.reload();
  }
});
