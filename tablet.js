/* GAIA tablet field desk enhancements.
   A single responsive site: no duplicated data, routes or tablet-specific accounts.
   Keep the opened specimen in view when it expands across the tablet grid. */
(() => {
  "use strict";
  const media=window.matchMedia("(min-width:700px) and (max-width:1280px)");
  const grid=document.getElementById("grid");
  const nav=document.querySelector(".gaia-tablet-desk");
  if(!grid||!nav) return;
  const reduced=window.matchMedia("(prefers-reduced-motion:reduce)");

  // A full-width details card may jump to a new grid row. Bring its header
  // back into view after layout settles, but only for a tablet viewport.
  grid.addEventListener("toggle",event=>{
    const card=event.target;
    if(!media.matches || !card?.matches?.(".card") || !card.open) return;
    window.requestAnimationFrame(()=>{
      window.requestAnimationFrame(()=>{
        if(!media.matches || !card.isConnected || !card.open) return;
        card.scrollIntoView({behavior:reduced.matches?"auto":"smooth",block:"start"});
      });
    });
  },true);

  nav.addEventListener("click",event=>{
    const link=event.target.closest("a[href^='#']");
    if(!link || !media.matches) return;
    const anchor=link.getAttribute("href");
    if(anchor==="#gaia-tasks" || anchor==="#gaia-insights"){
      const details=document.querySelector(anchor);
      if(details) details.open=true;
    }
    if(anchor==="#search"){
      const search=document.getElementById("search");
      if(search) window.requestAnimationFrame(()=>search.focus({preventScroll:true}));
    }
  });
})();