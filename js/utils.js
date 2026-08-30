function escapeHtml(v){
  return String(v??'').replace(/[&<>'"]/g,c=>({
    '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'
  }[c]));
}

function numberOrNull(v){
  if(v==null || v==='') return null;
  const num=Number(v);
  return Number.isFinite(num) ? num : null;
}
