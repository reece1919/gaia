/* GAIA private photo journal: mobile camera/library -> Supabase Storage + RLS.
   Photos are private to the signed-in account and do not change GitHub's
   public fallback images. The newest upload becomes the signed-in cover. */
(() => {
  "use strict";
  const BUCKET = "gaia-plant-photos";
  const MAX_INPUT = 35 * 1024 * 1024;
  const MAX_UPLOAD = 8 * 1024 * 1024;
  const MAX_SIDE = 1800;
  const esc = v => String(v ?? "").replace(/[&<>"']/g, c =>
    ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const today = () => {
    const d = new Date();
    return [d.getFullYear(),String(d.getMonth()+1).padStart(2,"0"),
      String(d.getDate()).padStart(2,"0")].join("-");
  };
  function displayDate(s) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s||"")) return String(s||"");
    const [y,m,d] = s.split("-").map(Number);
    return new Intl.DateTimeFormat(undefined,{month:"short",day:"numeric",year:"numeric"})
      .format(new Date(y,m-1,d));
  }
  function analysisMarkup(p) {
    const status = p.analysis_status || "pending";
    const labels = {
      pending: "Awaiting GAIA review",
      reviewed: "Reviewed",
      needs_attention: "Needs attention",
      unavailable: "Review unavailable",
      processing: "Review in progress"
    };
    const label = labels[status] || labels.pending;
    const summary = String(p.analysis_summary || "").trim();
    const confidence = p.analysis_confidence == null ? NaN : Number(p.analysis_confidence);
    const confidenceText = Number.isFinite(confidence)
      ? " · " + Math.round(confidence * 100) + "% confidence"
      : "";
    const reviewedText = p.analyzed_at
      ? " · " + new Intl.DateTimeFormat(undefined,{month:"short",day:"numeric"})
          .format(new Date(p.analyzed_at))
      : "";
    const findings=Array.isArray(p.analysis_findings)?p.analysis_findings:[];
    const care=findings.filter(f=>f?.kind==="care").slice(0,2);
    return '<div class="photo-analysis photo-analysis-' + esc(status) + '">' +
      '<div class="photo-analysis-head"><span>' + esc(label) + '</span>' +
      '<small>' + esc(reviewedText + confidenceText) + '</small></div>' +
      (summary ? '<p>' + esc(summary) + '</p>' : '') +
      (care.length ? '<ul class="gaia-photo-recommendations">' + care.map(f=>'<li>'+esc(f.text)+(f.reason?' — '+esc(f.reason):'')+'</li>').join('') + '</ul>' : '') +
      '</div>';
  }
  function safeError(error) {
    console.error("GAIA photo journal:",error);
    return error?.message || "Please try again.";
  }
  let client = null, user = null, plants = [];
  let photos = [], signed = new Map(), pending = new Set();
  let sequence = 0, lastRefresh = 0;
  let message = "", messageIsError = false;
  const covers = new Map();

  function report(msg,error=false) {
    message=msg; messageIsError=error;
    const node=document.getElementById("gaia-photo-message");
    if(node) {
      node.hidden=!msg;
      node.textContent=msg;
      node.classList.toggle("photo-error",error);
    }
  }
  function panel(p) {
    const hint = /Android/i.test(navigator.userAgent || "") ?
      "Photos resize automatically; newest becomes the card image. On Android, use JPG, PNG or WebP. Samsung HEIF/HEIC photos must first be converted to JPEG." :
      "Photos are resized automatically. The newest upload becomes the card image on signed-in devices.";
    return '<section class="plant-photo-journal" data-plant-photo="' + esc(p.id) + '">' +
      '<div class="photo-journal-head"><strong>Photo journal</strong>' +
      '<span class="photo-count" data-photo-count>Original photo only</span></div>' +
      '<div class="photo-signed-out">Sign in under <strong>Sync, account &amp; backup</strong> to add private photos.</div>' +
      '<div class="photo-signed-in" hidden>' +
      '<form class="plant-photo-form">' +
      '<label>Take or choose a photo <input type="file" name="image" accept="image/*,.heic,.heif" required></label>' +
      '<div class="photo-input-row">' +
      '<label>Photo date <input type="date" name="taken_on" value="' + today() + '" required></label>' +
      '<label>Optional note <input type="text" name="caption" maxlength="350" placeholder="New leaf, repotting, growth…"></label>' +
      '</div><button type="submit" class="photo-upload-button">Upload photo</button>' +
      '<small class="photo-upload-hint">' + esc(hint) + '</small>' +
      '</form></div>' +
      '<p class="photo-local-status" role="status" aria-live="polite" hidden></p>' +
      '<div class="photo-gallery" data-photo-gallery aria-live="polite"></div>' +
      '</section>';
  }
  function mount(data) {
    if (plants.length) return;
    plants = data;
    document.querySelectorAll("#grid .card").forEach((card,i) => {
      const p=plants[i], section=card.querySelector(".care"), img=card.querySelector(".photo img");
      if (!p || !section) return;
      if (img) covers.set(String(p.id),{element:img,original:img.getAttribute("src")});
      section.insertAdjacentHTML("afterbegin",panel(p));
    });
    render();
  }
  function localStatus(plantId, msg, isError = false) {
    const panel = [...document.querySelectorAll(".plant-photo-journal")]
      .find(e => e.dataset.plantPhoto === String(plantId));
    const node=panel?.querySelector(".photo-local-status");
    if (node) {
      node.hidden=!msg; node.textContent=msg;
      node.classList.toggle("photo-error",isError);
    }
  }
  function sortedPhotos(p) {
    return photos.filter(x => x.plant_id === p).sort((a,b) =>
      (b.created_at||"").localeCompare(a.created_at||"") || b.id.localeCompare(a.id));
  }
  function render() {
    document.querySelectorAll(".plant-photo-journal").forEach(section => {
      const plantId=section.dataset.plantPhoto, items=user ? sortedPhotos(plantId) : [];
      const active=!!client && !!user;
      section.querySelector(".photo-signed-out").hidden=active;
      section.querySelector(".photo-signed-in").hidden=!active;
      section.querySelector("[data-photo-count]").textContent =
        items.length ? items.length + (items.length===1 ? " private photo" : " private photos") :
        "Original photo only";
      const gallery=section.querySelector("[data-photo-gallery]");
      gallery.innerHTML=items.length
        ? '<div class="photo-gallery-grid">' + items.slice(0,30).map((p,i) => {
          const url=signed.get(p.object_path);
          return '<div class="photo-gallery-item">' +
            (url ? '<a href="' + esc(url) + '" target="_blank" rel="noopener noreferrer" title="View full photo">' +
            '<img src="' + esc(url) + '" loading="lazy" decoding="async" alt="' +
            esc(p.caption || "Plant photo") + '"></a>' :
            '<div class="photo-awaiting">Preview unavailable</div>') +
            '<div class="photo-gallery-meta"><time>' + esc(displayDate(p.taken_on)) +
            '</time>' + (i===0 ? '<span class="photo-cover-label">Current</span>' : '') + '</div>' +
            (p.caption ? '<div class="photo-caption">' + esc(p.caption) + '</div>' : '') +
            analysisMarkup(p) +
            '<button type="button" data-photo-test="' + esc(p.id) + '">Test secure access</button><button type="button" data-photo-delete="' + esc(p.id) + '">Delete</button>' +
            '</div>';
        }).join("") + '</div>' +
        (items.length>30?'<p class="photo-hint">Showing the 30 most recently uploaded photos.</p>':'')
        : '';
      const cover = covers.get(String(plantId));
      if (cover) {
        const latest=items.find(p=>signed.has(p.object_path));
        const src=latest ? signed.get(latest.object_path) : cover.original;
        if (cover.element.getAttribute("src") !== src) cover.element.setAttribute("src",src);
        cover.element.alt=latest ? "Latest private photo for " +
          (plants.find(p=>String(p.id)===plantId)?.name || "plant") : 
          (plants.find(p=>String(p.id)===plantId)?.photoAlt || "Plant photo");
      }
    });
    document.getElementById("gaia-photo-sync-state").textContent = user ?
      "Private photos sync with your account" : "Sign in to upload photos";
    if (message) report(message,messageIsError);
  }
  function updateLogin(clientValue,userValue) {
    const nextId=userValue?.id||null, priorId=user?.id||null;
    client=clientValue||null;
    user=userValue||null;
    if (nextId!==priorId) {
      ++sequence;
      photos=[];
      signed.clear();
      message="";
      render();
      if (user) void refresh();
    } else {
      render();
    }
  }
  async function refresh() {
    if (!client||!user||!plants.length) return;
    const request=++sequence, owner=user.id;
    try {
      const {data,error}=await client.from("plant_photos")
        .select("id,plant_id,object_path,caption,taken_on,created_at,analysis_status,analysis_summary,analysis_findings,analysis_confidence,analyzed_at,analysis_source")
        .order("created_at",{ascending:false})
        .limit(1500);
      if (error) throw error;
      if (request!==sequence||user?.id!==owner) return;
      const rows=data||[];
      const urlMap=new Map();
      const folder=client.storage.from(BUCKET);
      for(let i=0;i<rows.length;i+=80) {
        const batch=rows.slice(i,i+80);
        const paths=batch.map(p=>p.object_path);
        const result=await folder.createSignedUrls(paths,3600);
        if(result.error) throw result.error;
        const signedResults=result.data||[];
        signedResults.forEach((value,j)=>{
          if(value?.signedUrl) urlMap.set(paths[j],value.signedUrl);
        });
      }
      if(request!==sequence||user?.id!==owner) return;
      photos=rows;
      signed=urlMap;
      lastRefresh=Date.now();
      render();
      if(rows.length && urlMap.size===0) report("Photo details loaded, but previews could not be accessed. Try syncing again.",true);
    } catch(error) {
      if(request===sequence) report("Could not load cloud photos: "+safeError(error),true);
    }
  }
  async function loadImage(file) {
    // Samsung browsers can decode some Gallery selections through
    // createImageBitmap when an Image + object URL path fails.
    if (typeof createImageBitmap === "function") {
      try {
        const bitmap = await createImageBitmap(file);
        return {
          source: bitmap, width: bitmap.width, height: bitmap.height,
          release: () => bitmap.close()
        };
      } catch (error) {
        console.warn("GAIA bitmap decode unavailable; trying image fallback", error);
      }
    }
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      // Keep the object URL alive until the canvas has finished drawing.
      // Revoking it during onload can break image access in some WebViews.
      const release = () => URL.revokeObjectURL(url);
      img.onload = () => resolve({
        source: img, width: img.naturalWidth, height: img.naturalHeight, release
      });
      img.onerror = () => {
        release();
        reject(new Error("This browser could not open the photo. Try a JPG or PNG image."));
      };
      img.src = url;
    });
  }
  async function compress(file) {
    if(file.size>MAX_INPUT) throw new Error("Select an image smaller than 35 MB.");
    if(!/^image\//i.test(file.type||"") && !/\.(jpe?g|png|webp|heic|heif)$/i.test(file.name||""))
      throw new Error("Please choose a photo.");
    if (/Android/i.test(navigator.userAgent || "") &&
        (/^image\/hei[cf]$/i.test(file.type || "") || /\.hei[cf]$/i.test(file.name || ""))) {
      throw new Error("Android browsers cannot open HEIF/HEIC photos. Choose a JPG or PNG copy, or turn off HEIF/High efficiency pictures in Samsung Camera settings.");
    }
    const canvas = document.createElement("canvas");
    let decoded;
    try {
      decoded = await loadImage(file);
      const w = decoded.width, h = decoded.height;
      if(!w || !h) throw new Error("The selected image has no readable dimensions.");
      const ratio = Math.min(1, MAX_SIDE / Math.max(w,h));
      canvas.width = Math.max(1, Math.round(w*ratio));
      canvas.height = Math.max(1, Math.round(h*ratio));
      const ctx = canvas.getContext("2d", {alpha:false});
      if(!ctx) throw new Error("Your browser could not prepare the image.");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0,0,canvas.width,canvas.height);
      ctx.drawImage(decoded.source,0,0,canvas.width,canvas.height);
      const blob = await new Promise((resolve,reject) => canvas.toBlob(
        x => x ? resolve(x) : reject(new Error("Photo conversion failed.")),
        "image/jpeg",0.84
      ));
      if(blob.size>MAX_UPLOAD) throw new Error("Photo is too large after resizing. Try a smaller image.");
      return blob;
    } finally {
      decoded?.release();
      canvas.width=canvas.height=0;
    }
  }
  async function upload(form) {
    if(!client||!user) {report("Sign in before uploading plant photos.",true);return;}
    const section=form.closest(".plant-photo-journal");
    const id=section?.dataset.plantPhoto;
    if(!plants.some(p=>String(p.id)===id)) {report("Plant was not found.",true);return;}
    if(pending.has(id)) return;
    const file=form.querySelector('input[name="image"]')?.files?.[0];
    if(!file){report("Choose a photo first.",true);return;}
    const taken=form.elements.taken_on.value,caption=form.elements.caption.value.trim().slice(0,350);
    if(!/^\d{4}-\d{2}-\d{2}$/.test(taken)||taken>today()) {
      report("Choose a valid photo date (today or earlier).",true);return;
    }
    const owner=user.id;
    const uuid=globalThis.crypto?.randomUUID?.();
    if(!uuid){report("Secure photo upload needs HTTPS and a supported browser.",true);return;}
    const path=owner+"/"+id+"/"+uuid+".jpg";
    const button=form.querySelector('button[type="submit"]');
    pending.add(id);button.disabled=true;button.textContent="Uploading…";
    localStatus(id,"Preparing photo…");
    let objectUploaded=false;
    try {
      report("Preparing and uploading "+file.name+"…");
      const blob=await compress(file);
      localStatus(id,"Uploading compressed photo…");
      if(owner!==user?.id) throw new Error("Account changed. Please retry while signed in.");
      const result=await client.storage.from(BUCKET)
        .upload(path,blob,{contentType:"image/jpeg",upsert:false,cacheControl:"3600"});
      if(result.error) throw result.error;
      objectUploaded=true;
      const row={id:uuid,user_id:owner,plant_id:id,object_path:path,caption,taken_on:taken};
      const inserted=await client.from("plant_photos").insert(row);
      if(inserted.error) throw inserted.error;
      objectUploaded=false;
      form.reset();
      form.elements.taken_on.value=today();
      await refresh();
      localStatus(id,"Photo saved and queued for GAIA visual review.");
      report("Photo saved privately and queued for GAIA visual review.");
    } catch(error) {
      if(objectUploaded) {
        try{await client.storage.from(BUCKET).remove([path]);}
        catch(cleanupError){console.warn("GAIA photo upload cleanup failed",cleanupError);}
      }
      localStatus(id,"Upload failed: "+safeError(error),true);
      report("Photo wasn't saved: "+safeError(error),true);
    } finally {
      pending.delete(id);
      button.disabled=false;button.textContent="Upload photo";
    }
  }
  async function testPhotoAccess(id) {
    if (!client || !user) return report("Sign in to test private photo access.", true);
    const photo = photos.find(p => p.id === id);
    if (!photo) return report("Photo not found.", true);
    localStatus(photo.plant_id, "Testing secure photo retrieval…");
    try {
      const { data: sessionData, error: sessionError } = await client.auth.getSession();
      if (sessionError || !sessionData?.session?.access_token) throw new Error("Please sign in again.");
      const response = await fetch("https://zdurujqwhxqrwbhwzzxg.supabase.co/functions/v1/gaia-photo-access", {
        method: "POST",
        headers: {
          "Authorization": "Bearer " + sessionData.session.access_token,
          "apikey": client.supabaseKey,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ photo_id: id })
      });
      if (!response.ok) throw new Error("Access endpoint returned HTTP " + response.status);
      const payload = await response.json();
      if (payload.photo_id !== id || !payload.signed_url) throw new Error("Invalid access response.");
      const imageResponse = await fetch(payload.signed_url, { cache: "no-store" });
      if (!imageResponse.ok) throw new Error("Photo download returned HTTP " + imageResponse.status);
      const blob = await imageResponse.blob();
      if (!blob.type.startsWith("image/") || !blob.size) throw new Error("Downloaded file is not an image.");
      const bitmap = await createImageBitmap(blob);
      const dimensions = bitmap.width + " × " + bitmap.height;
      bitmap.close();
      localStatus(photo.plant_id, "Secure photo access PASSED: " + dimensions + ", " + Math.round(blob.size / 1024) + " KB.");
      report("Secure private photo retrieval passed. This does not yet verify nightly AI image analysis.");
    } catch (error) {
      localStatus(photo.plant_id, "Secure photo access FAILED: " + safeError(error), true);
      report("Secure photo access test failed: " + safeError(error), true);
    }
  }
  async function removePhoto(id) {
    if(!client||!user) return;
    const target=photos.find(p=>p.id===id);
    if(!target||!window.confirm("Delete this uploaded photo from GAIA? This cannot be undone.")) return;
    try {
      const r=await client.from("plant_photos").delete().eq("id",id);
      if(r.error) throw r.error;
      const file=await client.storage.from(BUCKET).remove([target.object_path]);
      if(file.error) {
        report("Removed from the gallery, but storage cleanup failed. You can contact support to remove the orphaned file.",true);
      } else report("Photo deleted from GAIA.");
      await refresh();
    }catch(error){report("Could not delete the photo: "+safeError(error),true);}
  }
  document.addEventListener("gaia:ready",ev=>mount(ev.detail.plants||[]));
  document.addEventListener("gaia:auth",ev=>updateLogin(ev.detail.client,ev.detail.user));
  document.addEventListener("gaia:photo-reviews-changed",()=>{ if(user) void refresh(); });
  document.addEventListener("gaia:care-synced",()=>{
    if(user) void refresh();
  });
  document.addEventListener("visibilitychange",()=>{
    if(document.visibilityState==="visible" && user && Date.now()-lastRefresh > 5*60*1000)
      void refresh();
  });
  document.addEventListener("change",event=>{
    const input=event.target.closest?.('.plant-photo-form input[type="file"]');
    if (!input) return;
    const id=input.closest(".plant-photo-journal")?.dataset.plantPhoto;
    const file=input.files?.[0];
    if (!file) return localStatus(id,"");
    if (/Android/i.test(navigator.userAgent || "") &&
        (/^image\/hei[cf]$/i.test(file.type || "") || /\.hei[cf]$/i.test(file.name || ""))) {
      localStatus(id,"Samsung HEIF/HEIC cannot be read by this browser. Choose a JPG or PNG photo instead.",true);
    } else {
      localStatus(id,"Selected: "+file.name+". Tap Upload photo.");
    }
  });
  document.addEventListener("submit",event=>{
    if(!event.target.matches(".plant-photo-form")) return;
    event.preventDefault();
    void upload(event.target);
  });
  document.addEventListener("click",event=>{
    const test=event.target.closest("[data-photo-test]");
    if(test) void testPhotoAccess(test.dataset.photoTest);
    const button=event.target.closest("[data-photo-delete]");
    if(button) void removePhoto(button.dataset.photoDelete);
  });
  const settings=window.GAIA_CLOUD;
  if(window.GAIA_DATA?.plants) mount(window.GAIA_DATA.plants);
  if(settings) updateLogin(settings.client,settings.user);
})();
