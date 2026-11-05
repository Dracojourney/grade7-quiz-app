/* Public preview notices only; the original application logic is unchanged. */
(function(){
  const footer=document.querySelector('.site-footer');
  if(footer){const notice=document.createElement('span');notice.textContent='网页预览 · 原书配图和内页仅在本地完整版提供';notice.style.cssText='font-size:11px;color:#536174;line-height:1.7';footer.prepend(notice);const old=footer.querySelector(':scope > span:not(:first-child)');if(old)old.hidden=true;}
  document.addEventListener('click',event=>{
    if(!event.target.closest('.notes-link'))return;
    event.preventDefault();event.stopImmediatePropagation();
    const toast=document.getElementById('toast');toast.textContent='原书笔记内页仅在本地完整版提供，公开预览不包含这些图片。';toast.hidden=false;setTimeout(()=>toast.hidden=true,6000);
  },true);
})();
