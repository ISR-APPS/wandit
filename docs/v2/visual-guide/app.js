(() => {
  'use strict';
  const chapters = [...(window.GUIDE_PART_A || []), ...(window.GUIDE_PART_B || [])];
  if (!chapters.length || !window.renderIllustration) {
    document.getElementById('chapter-title').textContent = 'The guide cannot load.';
    document.getElementById('chapter-subtitle').textContent = 'Open wandit-v2-visual-guide.html. That file contains the complete guide.';
    return;
  }
  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const arrow = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="m9 5 7 7-7 7M16 12H3"/></svg>';
  const volume = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4V5Z"/><path d="M15 8c3 2 3 6 0 8m3-11c5 4 5 10 0 14"/></svg>';
  const check = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="m3 8 3 3 7-7"/></svg>';
  const storageKey = 'wandit-v2-visual-guide-v1';
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(storageKey) || '{}'); } catch {}
  let chapterIndex = Math.max(0, chapters.findIndex(c => c.id === saved.chapter));
  let stepIndex = Math.min(3, Math.max(0, Number(saved.step) || 0));
  const completed = new Set(Array.isArray(saved.completed) ? saved.completed.filter(id => chapters.some(c => c.id === id)) : []);
  const answers = saved.answers && typeof saved.answers === 'object' ? saved.answers : {};
  let playTimer = null;
  let playing = false;
  let speaking = false;
  let speechGeneration = 0;
  const terms = [];
  const termMap = new Map();
  chapters.forEach((c, index) => c.terms.forEach(t => {
    const key = t.term.toLowerCase();
    if (!termMap.has(key)) { const entry = {...t, chapterIndex:index}; termMap.set(key, entry); terms.push(entry); }
  }));
  terms.sort((a,b) => a.term.localeCompare(b.term));
  const termPattern = new RegExp('\\b(' + [...termMap.values()].map(t=>t.term).sort((a,b)=>b.length-a.length).map(t=>t.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|') + ')\\b', 'gi');
  function explainableText(value) {
    const text=String(value); let output='',position=0,count=0; const seen=new Set();
    for(const match of text.matchAll(termPattern)) {
      const entry=termMap.get(match[0].toLowerCase());
      output+=esc(text.slice(position,match.index));
      if(entry&&count<4&&!seen.has(entry.term)){output+=`<button class="inline-term" data-term="${esc(entry.term)}" aria-label="Explain ${esc(entry.term)}">${esc(match[0])}</button>`;seen.add(entry.term);count++;}
      else output+=esc(match[0]);
      position=match.index+match[0].length;
    }
    return output+esc(text.slice(position));
  }
  const reportURL = new URL(document.documentElement.dataset.report, location.href);
  $('full-report-link').href = reportURL.href;
  $('back-step').innerHTML = arrow.replace('viewBox=', 'style="transform:rotate(180deg)" viewBox=');
  const current = () => chapters[chapterIndex];
  function save() {
    try { localStorage.setItem(storageKey, JSON.stringify({chapter:current().id,step:stepIndex,completed:[...completed],answers})); } catch { document.querySelector('.save-note').textContent = 'This browser cannot save your place.'; }
  }
  function stopSpeech() {
    speechGeneration++;
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    speaking = false;
    $('listen').innerHTML = volume + '<span>Listen</span>';
    $('listen').setAttribute('aria-label','Listen to this step');
    $('voice-status').textContent = '';
  }
  function pause() {
    if (playTimer) clearTimeout(playTimer);
    playTimer = null;
    playing = false;
    $('autoplay').textContent = 'Play steps';
    $('autoplay').setAttribute('aria-pressed','false');
  }
  function scheduleNext() {
    clearTimeout(playTimer);
    const words = current().steps[stepIndex].body.split(/\s+/).length;
    playTimer = setTimeout(() => {
      if (stepIndex === current().steps.length - 1) { pause(); return; }
      stepIndex++;
      renderStep();
      save();
      scheduleNext();
    }, Math.max(10500, words * 420 + 2000));
  }
  function renderNav() {
    let lastGroup = '';
    $('chapter-nav').innerHTML = chapters.map((c, i) => {
      const group = c.group !== lastGroup ? `<p class="nav-group">${esc(c.group)}</p>` : '';
      lastGroup = c.group;
      return `${group}<button class="nav-chapter" data-chapter="${i}" ${i===chapterIndex?'aria-current="page"':''} aria-label="Chapter ${i+1}: ${esc(c.title)}${completed.has(c.id)?', read':''}"><span class="nav-number">${String(i+1).padStart(2,'0')}</span><span>${esc(c.title)}</span><span class="nav-check">${completed.has(c.id)?check:''}</span></button>`;
    }).join('');
    $('progress-count').textContent = `${completed.size} of ${chapters.length} chapters read`;
    $('progress-percent').textContent = `${Math.round(completed.size/chapters.length*100)}%`;
    $('progress').value = completed.size;
    $('progress').max = chapters.length;
  }
  function renderStep() {
    stopSpeech();
    const c = current();
    const step = c.steps[stepIndex];
    $('step-number').textContent = `Step ${stepIndex+1} of ${c.steps.length}`;
    $('step-title').textContent = step.title;
    $('step-body').innerHTML = explainableText(step.body);
    $('scene-caption').textContent = step.caption;
    $('illustration').innerHTML = `<div class="art-enter" style="width:100%">${window.renderIllustration(c,stepIndex)}</div>`;
    $('step-dots').innerHTML = c.steps.map((s,i) => `<button class="step-dot ${i===stepIndex?'active':i<stepIndex?'past':''}" data-step="${i}" aria-label="Step ${i+1}: ${esc(s.title)}" ${i===stepIndex?'aria-current="step"':''}></button>`).join('');
    $('back-step').disabled = stepIndex === 0;
    $('next-step').innerHTML = `${stepIndex < c.steps.length-1 ? 'Next step' : chapterIndex < chapters.length-1 ? 'Next chapter' : 'Finish the guide'} ${arrow}`;
    $('replay').disabled = stepIndex === 0 && !playing;
    $('listen').disabled = !('speechSynthesis' in window && 'SpeechSynthesisUtterance' in window);
    if ($('listen').disabled) $('listen').title = 'This browser has no speech control.';
    $('complete-banner').hidden = true;
  }
  function renderQuiz() {
    const c = current();
    $('quiz-heading').textContent = c.quiz.question;
    const selected = Number.isInteger(answers[c.id]) ? answers[c.id] : -1;
    $('quiz-options').innerHTML = c.quiz.options.map((o,i) => `<button class="quiz-option" data-answer="${i}" aria-pressed="${selected===i}"><span class="option-letter" aria-hidden="true">${String.fromCharCode(65+i)}</span><span>${esc(o)}</span></button>`).join('');
    $('quiz-feedback').textContent = selected<0 ? '' : `${selected===c.quiz.answer?'Correct.':'The correct answer is '+String.fromCharCode(65+c.quiz.answer)+'.'} ${c.quiz.explanation}`;
  }
  function renderChapter(scroll = false) {
    pause(); stopSpeech();
    const c = current();
    document.title = `${chapterIndex+1}. ${c.title} — Wandit V2`;
    $('chapter-group').textContent = c.group;
    $('chapter-number').textContent = `CHAPTER ${String(chapterIndex+1).padStart(2,'0')} / ${chapters.length}`;
    $('chapter-title').textContent = c.title;
    $('chapter-subtitle').textContent = c.subtitle;
    $('takeaway').textContent = c.takeaway;
    const url = new URL(reportURL); url.hash = c.sourceAnchor;
    $('source-link').href = url.href;
    $('source-link').textContent = `Source: ${c.sourceSections}`;
    $('term-buttons').innerHTML = c.terms.map(t => `<button class="term-button" data-term="${esc(t.term)}">${esc(t.term)}<span aria-hidden="true">+</span></button>`).join('');
    $('detail-list').innerHTML = c.details.map(d => `<details><summary>${esc(d.title)}</summary><p>${esc(d.body)}</p></details>`).join('');
    $('previous-chapter').disabled = chapterIndex===0;
    $('next-chapter').textContent = chapterIndex===chapters.length-1 ? 'Finish the guide' : `Chapter ${String(chapterIndex+2).padStart(2,'0')} ${chapters[chapterIndex+1].title}`;
    $('footer-count').textContent = `${chapterIndex+1} / ${chapters.length}`;
    renderNav(); renderStep(); renderQuiz(); save();
    if (scroll) { window.scrollTo({top:0,behavior:'instant'}); $('main').focus({preventScroll:true}); }
  }
  function goChapter(index, scroll = true) {
    chapterIndex = Math.max(0,Math.min(chapters.length-1,index)); stepIndex=0;
    try { history.replaceState(null,'',`#${current().id}`); } catch {}
    closeChapters(); renderChapter(scroll);
  }
  function finishChapter() {
    completed.add(current().id); save(); renderNav();
    if (chapterIndex<chapters.length-1) { goChapter(chapterIndex+1); return; }
    pause(); stopSpeech(); $('complete-banner').hidden=false;
    $('complete-banner').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'center'});
  }
  function changeStep(index) { pause(); stepIndex=index; renderStep(); save(); }
  function closeChapters() { $('sidebar').classList.remove('open'); $('chapters-toggle').setAttribute('aria-expanded','false'); }
  function openGlossary(term = '') {
    pause(); stopSpeech(); $('term-search').value=term; renderGlossary(); $('glossary-dialog').showModal();
    $('term-search').focus(); if (term) $('term-search').select();
  }
  function renderGlossary() {
    const search = $('term-search').value.trim().toLowerCase();
    const results = terms.filter(t => `${t.term} ${t.definition} ${t.example||''}`.toLowerCase().includes(search)).sort((a,b)=>Number(b.term.toLowerCase()===search)-Number(a.term.toLowerCase()===search));
    $('term-count').textContent = `${results.length} ${results.length===1?'word':'words'}`;
    $('glossary-list').innerHTML = results.length ? results.map(t=>`<article class="glossary-entry"><h3>${esc(t.term)}</h3><p>${esc(t.definition)}</p>${t.example?`<p class="term-example">Example: ${esc(t.example)}</p>`:''}<button class="term-chapter-link" data-term-chapter="${t.chapterIndex}">Read chapter ${t.chapterIndex+1}: ${esc(chapters[t.chapterIndex].title)}</button></article>`).join('') : '<p>No matching word exists in this guide. Use a shorter search.</p>';
  }
  $('source-map').innerHTML = chapters.map((c,i)=>`<div class="source-row"><strong>${String(i+1).padStart(2,'0')} ${esc(c.title)}</strong><span>Report ${esc(c.sourceSections)}</span></div>`).join('');
  document.addEventListener('click', event => {
    const b = event.target.closest('button'); if (!b) return;
    if (b.dataset.chapter!==undefined) goChapter(Number(b.dataset.chapter));
    if (b.dataset.step!==undefined) changeStep(Number(b.dataset.step));
    if (b.dataset.term!==undefined) openGlossary(b.dataset.term);
    if (b.dataset.answer!==undefined) { answers[current().id]=Number(b.dataset.answer); renderQuiz(); save(); }
    if (b.dataset.close) $(b.dataset.close).close();
    if (b.dataset.termChapter!==undefined) { $('glossary-dialog').close(); goChapter(Number(b.dataset.termChapter)); }
  });
  $('next-step').addEventListener('click',()=>{pause();stepIndex<current().steps.length-1 ? changeStep(stepIndex+1) : finishChapter();});
  $('back-step').addEventListener('click',()=>{if(stepIndex>0)changeStep(stepIndex-1);});
  $('replay').addEventListener('click',()=>changeStep(0));
  $('autoplay').addEventListener('click',()=>{
    if(playing){pause();return;} stopSpeech(); if(stepIndex===current().steps.length-1){stepIndex=0;renderStep();}
    playing=true; $('autoplay').textContent='Pause steps'; $('autoplay').setAttribute('aria-pressed','true'); $('replay').disabled=false; scheduleNext();
  });
  $('listen').addEventListener('click',()=>{
    if(speaking){stopSpeech();return;} pause();
    const voices = window.speechSynthesis.getVoices();
    const voice = voices.find(v=>v.localService&&/^en(-|_)/i.test(v.lang));
    if(!voice){$('voice-status').textContent='This browser has no local English voice. You can read the step text.';return;}
    const step=current().steps[stepIndex];
    const utterance=new SpeechSynthesisUtterance(`${step.title}. ${step.body}`);
    utterance.voice=voice;utterance.lang=voice.lang;utterance.rate=.88;
    const generation=++speechGeneration;
    speaking=true;$('listen').innerHTML=volume+'<span>Stop</span>';$('listen').setAttribute('aria-label','Stop the voice');
    utterance.onend=()=>{if(generation===speechGeneration)stopSpeech();};
    utterance.onerror=()=>{if(generation===speechGeneration){stopSpeech();$('voice-status').textContent='The voice cannot start. You can read the step text.';}};
    window.speechSynthesis.speak(utterance);
  });
  $('previous-chapter').addEventListener('click',()=>goChapter(chapterIndex-1));
  $('next-chapter').addEventListener('click',()=>{if(stepIndex===current().steps.length-1)finishChapter();else if(chapterIndex<chapters.length-1)goChapter(chapterIndex+1);else{stepIndex=3;renderStep();save();}});
  $('review-first').addEventListener('click',()=>goChapter(0));
  $('glossary-open').addEventListener('click',()=>openGlossary());
  $('about-open').addEventListener('click',()=>{pause();stopSpeech();$('about-dialog').showModal();});
  $('about-mobile').addEventListener('click',()=>{pause();stopSpeech();closeChapters();$('about-dialog').showModal();});
  $('term-search').addEventListener('input',renderGlossary);
  $('chapters-toggle').addEventListener('click',()=>{const open=$('sidebar').classList.toggle('open');$('chapters-toggle').setAttribute('aria-expanded',String(open));});
  document.querySelectorAll('dialog').forEach(dialog=>dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}}));
  document.querySelectorAll('dialog').forEach(dialog=>dialog.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();dialog.close();}}));
  document.addEventListener('keydown',e=>{
    if(document.querySelector('dialog[open]')||!e.altKey)return;
    if(e.key==='ArrowRight'){e.preventDefault();$('next-step').click();}
    if(e.key==='ArrowLeft'&&stepIndex>0){e.preventDefault();changeStep(stepIndex-1);}
  });
  document.addEventListener('visibilitychange',()=>{if(document.hidden){pause();stopSpeech();}});
  window.addEventListener('pagehide',()=>{pause();stopSpeech();});
  window.addEventListener('hashchange',()=>{const found=chapters.findIndex(c=>c.id===location.hash.slice(1));if(found>=0)goChapter(found);});
  const hashIndex=chapters.findIndex(c=>c.id===location.hash.slice(1));
  if(hashIndex>=0){if(hashIndex!==chapterIndex)stepIndex=0;chapterIndex=hashIndex;}
  renderChapter();
})();
