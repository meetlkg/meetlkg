const search=document.querySelector('[data-filter-search]'),category=document.querySelector('[data-filter-category]');
function filter(){const query=(search?.value||'').toLowerCase(),value=category?.value||'';let shown=0;const cards=[...document.querySelectorAll('[data-search]')];for(const card of cards){const match=card.dataset.search.toLowerCase().includes(query)&&(!value||card.dataset.category===value);card.hidden=!match;if(match)shown++;}const count=document.querySelector('[data-filter-count]');if(count)count.textContent=`${shown} ${cards[0]?.classList.contains('archive-card')?'projects':'notes'}`;const empty=document.querySelector('[data-filter-empty]');if(empty)empty.hidden=shown>0;}
search?.addEventListener('input',filter);category?.addEventListener('change',filter);filter();
document.querySelectorAll('[data-copy-link]').forEach(button=>{
 const label=button.querySelector('[data-copy-label]'),mark=button.querySelector('use');
 let reset;
 button.addEventListener('click',async()=>{
  clearTimeout(reset);
  try{await navigator.clipboard.writeText(location.href);label.textContent='Link copied';mark.setAttribute('href','/static/world-icons.svg#check');}
  catch{label.textContent='Copy the address above';}
  reset=setTimeout(()=>{label.textContent='Copy link';mark.setAttribute('href','/static/world-icons.svg#arrow-up-right');},2500);
 });
});
