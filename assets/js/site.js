/* OpenGate Data — site behaviour (no dependencies). */
(function () {
  "use strict";

  /* ---- Mobile menu ---- */
  var toggle = document.querySelector(".menu-toggle");
  var menu = document.getElementById("mobile-menu");
  if (toggle && menu) {
    toggle.addEventListener("click", function () {
      var open = menu.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && menu.classList.contains("is-open")) {
        menu.classList.remove("is-open");
        toggle.setAttribute("aria-expanded", "false");
        toggle.focus();
      }
    });
  }

  /* ---- Desktop dropdown: click support for touch and keyboard ---- */
  document.querySelectorAll(".dropdown > button").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var wrap = btn.parentElement;
      var open = wrap.classList.toggle("is-open");
      btn.setAttribute("aria-expanded", open ? "true" : "false");
    });
  });
  document.addEventListener("click", function (e) {
    document.querySelectorAll(".dropdown.is-open").forEach(function (d) {
      if (!d.contains(e.target)) { d.classList.remove("is-open"); d.querySelector("button").setAttribute("aria-expanded", "false"); }
    });
  });

  /* ---- Tabs (home solutions switcher) ---- */
  document.querySelectorAll("[role=tablist]").forEach(function (list) {
    var tabs = Array.prototype.slice.call(list.querySelectorAll("[role=tab]"));
    function select(tab) {
      tabs.forEach(function (t) {
        var on = t === tab;
        t.setAttribute("aria-selected", on ? "true" : "false");
        t.tabIndex = on ? 0 : -1;
        var panel = document.getElementById(t.getAttribute("aria-controls"));
        if (panel) panel.hidden = !on;
      });
    }
    tabs.forEach(function (t, i) {
      t.addEventListener("click", function () { select(t); });
      t.addEventListener("keydown", function (e) {
        var n = null;
        if (e.key === "ArrowRight") n = tabs[(i + 1) % tabs.length];
        if (e.key === "ArrowLeft") n = tabs[(i - 1 + tabs.length) % tabs.length];
        if (n) { e.preventDefault(); n.focus(); select(n); }
      });
    });
  });

  /* ---- Hero video: respect reduced motion, keep muted ---- */
  var vid = document.querySelector(".hero video");
  if (vid) {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { vid.pause(); vid.removeAttribute("autoplay"); }
    else { vid.muted = true; var p = vid.play(); if (p && p.catch) p.catch(function () {}); }
  }

  /* ---- File drop zones ---- */
  var MAX_MB = 25;
  document.querySelectorAll(".dropzone").forEach(function (zone) {
    var input = zone.querySelector("input[type=file]");
    var list = zone.querySelector(".file-list");
    function render() {
      list.innerHTML = "";
      Array.prototype.forEach.call(input.files, function (f) {
        var li = document.createElement("li");
        var name = document.createElement("span"); name.textContent = f.name;
        var size = document.createElement("span"); size.textContent = (f.size / 1048576).toFixed(1) + " MB";
        li.appendChild(name); li.appendChild(size); list.appendChild(li);
      });
    }
    zone.addEventListener("click", function (e) { if (e.target !== input) input.click(); });
    zone.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); input.click(); } });
    input.addEventListener("change", render);
    ["dragenter", "dragover"].forEach(function (ev) { zone.addEventListener(ev, function (e) { e.preventDefault(); zone.classList.add("is-over"); }); });
    ["dragleave", "drop"].forEach(function (ev) { zone.addEventListener(ev, function (e) { e.preventDefault(); zone.classList.remove("is-over"); }); });
    zone.addEventListener("drop", function (e) {
      if (e.dataTransfer && e.dataTransfer.files.length) { input.files = e.dataTransfer.files; render(); }
    });
  });


  /* ---- Secure intake: upload statements to private storage, then send details ---- */
  var blobLib = null;
  function loadBlobClient() {
    if (window.OGDBlob) return Promise.resolve(window.OGDBlob);
    if (blobLib) return blobLib;
    blobLib = new Promise(function (resolve, reject) {
      var s = document.createElement("script");
      var me = document.querySelector('script[src*="assets/js/site.js"]');
      s.src = me ? me.src.replace(/site\.js(\?.*)?$/, "blob-client.js") : "/assets/js/blob-client.js";
      s.onload = function () { resolve(window.OGDBlob); };
      s.onerror = function () { blobLib = null; reject(new Error("upload library failed to load")); };
      document.head.appendChild(s);
    });
    return blobLib;
  }
  function safeName(name) {
    return String(name).replace(/\.pdf$/i, "").replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "statement";
  }
  function sendSubmission(form, cfg, btn) {
    var kind = form.getAttribute("data-intake");
    var fields = {};
    Array.prototype.forEach.call(form.elements, function (el) {
      if (!el.name || el.type === "file" || el.name === "website") return;
      if ((el.type === "checkbox" || el.type === "radio") && !el.checked) return;
      fields[el.name] = el.value;
    });
    var honeypot = form.querySelector('input[name="website"]');
    var fileInput = form.querySelector("input[type=file]");
    var files = fileInput ? Array.prototype.slice.call(fileInput.files) : [];
    var batch = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

    var uploads = Promise.resolve([]);
    if (files.length) {
      uploads = loadBlobClient().then(function (lib) {
        var done = 0;
        btn.textContent = "Uploading statements… 0 of " + files.length;
        return Promise.all(files.map(function (f) {
          return lib.upload("statements/" + batch + "/" + safeName(f.name) + ".pdf", f, {
            access: "private",
            handleUploadUrl: cfg.apiBase + "/upload",
            contentType: "application/pdf",
            multipart: f.size > 5 * 1048576
          }).then(function (res) {
            done += 1;
            btn.textContent = "Uploading statements… " + done + " of " + files.length;
            return { pathname: res.pathname, name: f.name, size: f.size };
          });
        }));
      });
    }

    return uploads.then(function (uploaded) {
      btn.textContent = "Sending securely…";
      return fetch(cfg.apiBase + "/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ form: kind, fields: fields, files: uploaded, website: honeypot ? honeypot.value : "" })
      });
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (data) {
        if (!r.ok || !data.ok) { var e = new Error("submit failed"); e.userMessage = data.error; throw e; }
        return data;
      });
    });
  }

  /* ---- Forms ---- */
  function showStatus(form, kind, msg) {
    var box = form.querySelector(".form-status");
    box.className = "form-status form-status--" + kind;
    box.textContent = msg;
    box.hidden = false;
    box.focus();
  }
  function clearErrors(form) {
    form.querySelectorAll(".field-error").forEach(function (n) { n.remove(); });
    form.querySelectorAll("[aria-invalid]").forEach(function (n) { n.removeAttribute("aria-invalid"); });
  }
  function addError(el, msg) {
    el.setAttribute("aria-invalid", "true");
    var p = document.createElement("p");
    p.className = "field-error"; p.textContent = msg;
    var host = el.closest(".field, .consent, .dropzone-wrap, fieldset") || el.parentElement;
    host.appendChild(p);
  }

  document.querySelectorAll("form[data-intake]").forEach(function (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      clearErrors(form);
      var firstBad = null;

      form.querySelectorAll("[required]").forEach(function (el) {
        var bad = el.type === "checkbox" ? !el.checked : !String(el.value || "").trim();
        if (el.type === "radio") {
          var group = form.querySelectorAll('input[name="' + el.name + '"]');
          bad = !Array.prototype.some.call(group, function (r) { return r.checked; });
          if (bad && el !== group[0]) return;
        }
        if (!bad && el.type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(el.value)) bad = true;
        if (bad) { addError(el, el.getAttribute("data-msg") || "This field is required."); firstBad = firstBad || el; }
      });

      var fileInput = form.querySelector("input[type=file]");
      if (fileInput && fileInput.files.length) {
        Array.prototype.forEach.call(fileInput.files, function (f) {
          var okType = /\.pdf$/i.test(f.name) || f.type === "application/pdf";
          if (!okType) { addError(fileInput, f.name + " is not a PDF."); firstBad = firstBad || fileInput; }
          if (f.size > MAX_MB * 1048576) { addError(fileInput, f.name + " is larger than " + MAX_MB + " MB."); firstBad = firstBad || fileInput; }
        });
      }

      if (firstBad) {
        showStatus(form, "err", "Please fix the highlighted fields.");
        firstBad.focus();
        return;
      }

      var cfg = window.OGD_CONFIG || {};
      if (!cfg.intakeEnabled) {
        showStatus(form, "warn", "Beta preview: this form isn't connected yet, so nothing was sent. When the site launches, submissions go to the OpenGate team through a secure intake.");
        return;
      }

      var btn = form.querySelector("button[type=submit]");
      var label = btn.textContent;
      btn.disabled = true;
      sendSubmission(form, cfg, btn)
        .then(function () {
          form.reset();
          form.querySelectorAll(".file-list").forEach(function (l) { l.innerHTML = ""; });
          showStatus(form, "ok", form.getAttribute("data-success") || "Thank you. Your submission was received and our team will be in touch.");
        })
        .catch(function (err) {
          showStatus(form, "err", (err && err.userMessage) || "Something went wrong and your submission was not sent. Please try again, or call (561) 223-1688.");
        })
        .then(function () { btn.disabled = false; btn.textContent = label; });
    });
  });
})();
