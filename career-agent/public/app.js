const API_BASE = "http://localhost:3001";

async function apiPost(path, body) {
  const res = await fetch(API_BASE + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Request failed (${res.status})`);
  }
  return res.json();
}

const CAREER_SKILLS = {
  "data scientist": ["python","sql","statistics","machine learning","data visualization","communication"],
  "product manager": ["roadmapping","stakeholder management","user research","data analysis","prioritization","communication"],
  "software engineer": ["data structures","algorithms","system design","git","testing","debugging"],
  "ux designer": ["user research","wireframing","prototyping","figma","usability testing","visual design"],
  "default": ["communication","problem solving","project management","critical thinking","collaboration"]
};

const INTERVIEW_QUESTIONS = {
  "data scientist": [
    {cat:"Technical", q:"Walk me through how you'd handle a dataset with a lot of missing values."},
    {cat:"Technical", q:"Explain the difference between supervised and unsupervised learning."},
    {cat:"Behavioral", q:"Tell me about a time you had to explain a technical result to a non-technical stakeholder."},
  ],
  "product manager": [
    {cat:"Case", q:"How would you prioritize a backlog with three competing high-value features?"},
    {cat:"Behavioral", q:"Describe a time you had to say no to a stakeholder. How did you handle it?"},
    {cat:"Strategy", q:"How do you decide when a feature is ready to ship?"},
  ],
  "software engineer": [
    {cat:"Technical", q:"How would you design a rate limiter for a public API?"},
    {cat:"Behavioral", q:"Tell me about a bug that was especially hard to track down."},
    {cat:"Technical", q:"What's your approach to writing tests for a new feature?"},
  ],
  "ux designer": [
    {cat:"Process", q:"Walk me through your process from research to a shipped design."},
    {cat:"Behavioral", q:"Tell me about a time user research changed your design direction."},
    {cat:"Critique", q:"How do you handle disagreement with engineering on feasibility?"},
  ],
  "default": [
    {cat:"Behavioral", q:"Tell me about a project you're proud of and why."},
    {cat:"Behavioral", q:"Describe a time you had to learn something quickly to get a job done."},
    {cat:"Motivation", q:"Why are you moving toward this role now?"},
  ]
};

function normalizeCareer(input){
  const key = input.trim().toLowerCase();
  return CAREER_SKILLS[key] ? key : "default";
}

function projectsFor(skill){
  const bank = {
    "python": [{t:"ETL mini-pipeline", d:"Pull a public dataset, clean it, and load it into a local SQLite DB with a Python script."}],
    "sql": [{t:"Query challenge set", d:"Write 10 progressively harder queries against a sample e-commerce schema (joins, window functions)."}],
    "statistics": [{t:"A/B test writeup", d:"Simulate an A/B test, compute significance, and write a one-page recommendation memo."}],
    "machine learning": [{t:"Baseline classifier", d:"Train and evaluate a baseline model on a Kaggle dataset; document your metric choices."}],
    "data visualization": [{t:"One-page dashboard", d:"Turn a messy CSV into a single clear dashboard aimed at a non-technical exec."}],
    "communication": [{t:"Technical explainer", d:"Write a 300-word explainer of a technical concept for a general audience."}],
    "roadmapping": [{t:"Quarterly roadmap draft", d:"Draft a mock quarterly roadmap for a fictional product with tradeoffs explained."}],
    "stakeholder management": [{t:"Conflict memo", d:"Write a memo resolving a mock conflict between eng and sales priorities."}],
    "user research": [{t:"5-user interview plan", d:"Draft a research plan and interview script for validating a feature idea."}],
    "system design": [{t:"Design doc", d:"Write a one-pager designing a URL shortener, covering scale and tradeoffs."}],
    "git": [{t:"Branching workflow", d:"Set up a repo demonstrating a feature-branch + PR review workflow."}],
    "figma": [{t:"Component library", d:"Build a small reusable component library for a mock app in Figma."}],
    "default": [{t:"Portfolio piece", d:"Build a small project that demonstrates this skill end to end."}]
  };
  const p = bank[skill] || bank.default;
  return [...p, {t:`${cap(skill)} teardown`, d:`Find a strong real-world example using ${skill} and write up what makes it work.`}];
}

function cap(s){ return s.charAt(0).toUpperCase()+s.slice(1); }

const state = {
  interests: [],
  careerKey: "default",
  careerLabel: "",
  skills: [],
  roadmap: [],
  selectedNode: null,
  interviewAnswers: {}, // index -> {score, note, text}
  weeklyPlan: null,
};

const els = {
  stepper: document.getElementById('stepper'),
  screens: document.querySelectorAll('.screen'),
  readinessPct: document.getElementById('readinessPct'),
  toast: document.getElementById('toast'),
};

function goto(screenId){
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
  document.getElementById('screen-'+screenId).classList.add('active');
  document.querySelectorAll('.step').forEach(s=>{
    s.classList.toggle('active', s.dataset.screen === screenId);
  });
  window.scrollTo({top:0, behavior:'smooth'});
}

function unlockStep(screenId){
  const stepEl = document.querySelector(`.step[data-screen="${screenId}"]`);
  stepEl.classList.remove('locked');
  stepEl.classList.add('clickable', 'done');
  stepEl.onclick = () => goto(screenId);
}

function showToast(msg){
  els.toast.textContent = msg;
  els.toast.classList.add('show');
  clearTimeout(showToast._t);
  showToast._t = setTimeout(()=>els.toast.classList.remove('show'), 2800);
}

// Toggles a button between its normal label and a loading label + disabled state.
function setBtnLoading(btn, isLoading, loadingLabel){
  if(!btn) return;
  if(isLoading){
    btn.dataset.originalLabel = btn.dataset.originalLabel || btn.textContent;
    btn.textContent = loadingLabel;
    btn.disabled = true;
  } else {
    btn.textContent = btn.dataset.originalLabel || btn.textContent;
    btn.disabled = false;
  }
}

function updateReadiness(){
  const skillPart = state.skills.length
    ? state.skills.reduce((a,s)=>a+s.level,0) / state.skills.length
    : 0;
  const roadmapPart = state.roadmap.length
    ? (state.roadmap.filter(n=>n.status==='done').length / state.roadmap.length) * 100
    : 0;
  const answers = Object.values(state.interviewAnswers);
  const interviewPart = answers.length
    ? (answers.reduce((a,x)=>a+x.score,0)/answers.length) * 10
    : 0;
  const weight = answers.length ? [0.4,0.35,0.25] : [0.55,0.45,0];
  const total = Math.round(skillPart*weight[0] + roadmapPart*weight[1] + interviewPart*weight[2]);
  els.readinessPct.textContent = total + '%';
}

/* --- tag input --- */
const tagBox = document.getElementById('tagBox');
const interestsInput = document.getElementById('interestsInput');
function renderTags(){
  tagBox.querySelectorAll('.tag-chip').forEach(c=>c.remove());
  state.interests.forEach((tag, i)=>{
    const chip = document.createElement('span');
    chip.className = 'tag-chip';
    chip.innerHTML = `${tag} <button data-i="${i}">×</button>`;
    tagBox.insertBefore(chip, interestsInput);
  });
}
tagBox.addEventListener('click', e=>{
  if(e.target.tagName === 'BUTTON'){
    state.interests.splice(+e.target.dataset.i, 1);
    renderTags();
  }
});
interestsInput.addEventListener('keydown', e=>{
  if(e.key === 'Enter' && interestsInput.value.trim()){
    e.preventDefault();
    state.interests.push(interestsInput.value.trim());
    interestsInput.value = '';
    renderTags();
  }
});
renderTags();

const analyzeBtn = document.getElementById('analyzeBtn');
analyzeBtn.addEventListener('click', async ()=>{
  const resume = document.getElementById('resumeInput').value;
  const targetRaw = document.getElementById('targetInput').value || 'General role';

  if(!resume.trim()){
    showToast('Paste your resume first.');
    return;
  }

  setBtnLoading(analyzeBtn, true, 'Analyzing…');
  try{
    const result = await apiPost('/api/analyze-skills', { resume, careerLabel: targetRaw });
    state.careerLabel = targetRaw;
    state.careerKey = result.careerKey;
    state.skills = result.skills;

    renderSkillMap();
    unlockStep('skillmap');
    goto('skillmap');
    updateReadiness();
  } catch(err){
    console.error(err);
    showToast('Could not analyze resume — check the backend is running.');
  } finally {
    setBtnLoading(analyzeBtn, false);
  }
});

function renderSkillMap(){
  document.getElementById('skillmapSub').textContent =
    `Target: ${state.careerLabel || cap(state.careerKey)}. ${state.skills.filter(s=>!s.have).length} of ${state.skills.length} core skills still need work.`;

  const svg = document.getElementById('skillChart');
  const skills = state.skills;
  const w = 900, chartTop = 40, chartBottom = 230, padX = 60;
  const chartH = chartBottom - chartTop;
  const n = skills.length;
  const usableW = w - padX * 2;
  const stepX = n > 1 ? usableW / (n - 1) : 0;
  const yFor = (level) => chartBottom - (level / 100) * chartH;

  let gridSvg = '';
  [0, 25, 50, 75, 100].forEach(t => {
    const y = yFor(t);
    gridSvg += `<line x1="${padX-10}" y1="${y}" x2="${w-padX+10}" y2="${y}" class="survey-grid-line"/>`;
    gridSvg += `<text x="${padX-18}" y="${y+4}" class="survey-tick-label" text-anchor="end">${t}</text>`;
  });

  const targetY = yFor(55);
  const targetLine = `<line x1="${padX-10}" y1="${targetY}" x2="${w-padX+10}" y2="${targetY}" class="survey-target-line"/>
    <text x="${w-padX+14}" y="${targetY+4}" class="survey-target-label">TARGET</text>`;

  const baseline = `<line x1="${padX-10}" y1="${chartBottom}" x2="${w-padX+10}" y2="${chartBottom}" class="survey-baseline"/>`;

  let stemsSvg = '';
  skills.forEach((s, i) => {
    const x = n > 1 ? padX + stepX * i : w / 2;
    const y = yFor(s.level);
    const cls = s.have ? 'have' : 'gap';
    const label = wrapLabel(cap(s.skill), 12);
    stemsSvg += `
      <g class="survey-stem ${cls}">
        <line x1="${x}" y1="${chartBottom}" x2="${x}" y2="${y}" class="stem-line"/>
        <circle cx="${x}" cy="${y}" r="14" class="stem-cap"/>
        <text x="${x}" y="${y+4}" class="stem-pct">${s.level}</text>
        ${label.map((line, li) => `<text x="${x}" y="${chartBottom + 22 + li*13}" class="stem-label">${line}</text>`).join('')}
      </g>`;
  });

  svg.innerHTML = gridSvg + baseline + targetLine + stemsSvg;

  const haveCount = skills.filter(s => s.have).length;
  document.getElementById('surveyStamp').innerHTML = `
    <svg viewBox="0 0 60 60" width="48" height="48" style="display:block">
      <circle cx="30" cy="30" r="26" stroke="var(--blueprint)" stroke-width="1.2" stroke-dasharray="2 3" fill="none"/>
      <circle cx="30" cy="30" r="15" stroke="var(--amber)" stroke-width="1.4" fill="none"/>
      <path d="M30 4 V12 M30 48 V56 M4 30 H12 M48 30 H56" stroke="var(--blueprint)" stroke-width="1.2"/>
      <circle cx="30" cy="30" r="3" fill="var(--amber)"/>
    </svg>
    <div>
      <div class="stamp-title">SURVEY<br/>COMPLETE</div>
      <div class="stamp-fraction">${haveCount}/${skills.length}</div>
      <div class="stamp-caption">above target</div>
    </div>
  `;
}

const buildRoadmapBtn = document.getElementById('buildRoadmapBtn');
buildRoadmapBtn.addEventListener('click', async ()=>{
  setBtnLoading(buildRoadmapBtn, true, 'Drafting...');
  try{
    state.roadmap = await apiPost('/api/build-roadmap', { skills: state.skills, careerLabel: state.careerLabel });
    renderRoadmap();
    unlockStep('roadmap');
    goto('roadmap');
    showToast('Roadmap drafted from your skill gaps.');
  } catch(err){
    console.error(err);
    showToast('Could not build roadmap — check the backend is running.');
  } finally {
    setBtnLoading(buildRoadmapBtn, false);
  }
});

function renderRoadmap(){
  const svg = document.getElementById('roadmapSvg');
  const n = state.roadmap.length;
  const padX = 70, w = 900, h = 220;
  const usable = w - padX*2;
  const points = state.roadmap.map((node,i)=>{
    const x = padX + (usable/(n-1||1))*i;
    const y = i%2===0 ? 70 : 150;
    return {...node, x, y};
  });

  let pathD = `M ${points[0].x} ${points[0].y}`;
  for(let i=1;i<points.length;i++){
    const prev = points[i-1], cur = points[i];
    const midX = (prev.x+cur.x)/2;
    pathD += ` C ${midX} ${prev.y}, ${midX} ${cur.y}, ${cur.x} ${cur.y}`;
  }

  let svgInner = `<path class="rm-path" d="${pathD}"></path>`;
  points.forEach((p,i)=>{
    const r = 22;
    const colorClass = p.status;
    let inner = '';
    if(p.status === 'done'){
      inner = `<path d="M ${p.x-8} ${p.y} l 5 6 l 11 -13" stroke="var(--green)" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
    } else {
      inner = `<text class="num" x="${p.x}" y="${p.y+1}">${i+1}</text>`;
    }
    const label = wrapLabel(p.title, 14);
    svgInner += `
      <g class="rm-node ${colorClass}" data-id="${p.id}">
        <circle class="outer" cx="${p.x}" cy="${p.y}" r="${r}"></circle>
        ${inner}
        ${label.map((line,li)=>`<text class="label" x="${p.x}" y="${p.y + r + 16 + li*13}">${line}</text>`).join('')}
      </g>`;
  });
  svg.innerHTML = svgInner;

  svg.querySelectorAll('.rm-node').forEach(g=>{
    g.addEventListener('click', ()=>{
      const id = +g.dataset.id;
      const node = state.roadmap.find(x=>x.id===id);
      if(node.status === 'locked'){
        showToast('Complete the current waypoint to unlock this one.');
        return;
      }
      state.selectedNode = id;
      renderMilestonePanel();
    });
  });
}

function wrapLabel(text, maxLen){
  const words = text.split(' ');
  const lines = [];
  let cur = '';
  words.forEach(w=>{
    if((cur+' '+w).trim().length > maxLen){ lines.push(cur.trim()); cur = w; }
    else cur += ' '+w;
  });
  if(cur.trim()) lines.push(cur.trim());
  return lines.slice(0,2);
}

function renderMilestonePanel(){
  const node = state.roadmap.find(n=>n.id===state.selectedNode);
  const panel = document.getElementById('milestonePanel');
  if(!node){ panel.innerHTML = '<div class="empty-note">Select a waypoint above to see its brief.</div>'; return; }

  const desc = node.why
    ? node.why
    : node.type === 'skill'
    ? `Focused sprint to build real, demonstrable proficiency in ${node.skill}.`
    : node.type === 'interview'
    ? `Prep block before your mock interview. Review common questions for ${state.careerLabel || cap(state.careerKey)} and rehearse out loud.`
    : `A capstone that ties your closed gaps together into one portfolio-ready piece.`;

  const projects = node.type === 'skill'
    ? projectsFor(node.skill)
    : projectsFor(state.careerKey === 'default' ? 'communication' : CAREER_SKILLS[state.careerKey][0]);

  const isSkillNode = node.type === 'skill';
  const isCurrent = node.status === 'current';

  panel.innerHTML = `
    <div class="mp-head">
      <div class="mp-title">${node.title}</div>
      <div class="mp-status ${node.status}">${node.status}</div>
    </div>
    <div class="mp-desc">${desc}</div>
    <div class="proj-grid">
      ${projects.map(p=>`
        <div class="proj-card">
          <div class="pt">${p.t}</div>
          <div class="pd">${p.d}</div>
          <div class="ph">Recommended project</div>
        </div>`).join('')}
    </div>
    ${isSkillNode ? `
      <div class="field">
        <label>Submit your work for AI review</label>
        <textarea id="submissionText" placeholder="Paste a link, code snippet, or a description of what you built..." ${isCurrent ? '' : 'disabled'}></textarea>
      </div>
      <div class="btn-row" style="justify-content:flex-start">
        <button class="btn" id="completeBtn" ${!isCurrent ? 'disabled' : ''}>Submit for Review</button>
      </div>
      <div id="evalFeedback"></div>
    ` : `
      <div class="btn-row" style="justify-content:flex-start">
        <button class="btn" id="completeBtn" ${!isCurrent ? 'disabled' : ''}>Mark Waypoint Complete</button>
      </div>
    `}
  `;

  const completeBtn = document.getElementById('completeBtn');
  if(!completeBtn) return;

  completeBtn.addEventListener('click', async ()=>{
    if(isSkillNode){
      const submission = document.getElementById('submissionText').value;
      if(!submission.trim()){ showToast('Describe or paste your work first.'); return; }

      setBtnLoading(completeBtn, true, 'Evaluating...');
      try{
        const evalResult = await apiPost('/api/evaluate-project', {
          waypointTitle: node.title,
          skill: node.skill,
          submission,
        });

        const fbBox = document.getElementById('evalFeedback');
        fbBox.innerHTML = `
          <div class="feedback-box">
            <span class="fb-score">Score: ${evalResult.score}/100 — ${evalResult.pass ? 'PASS' : 'NOT YET'}</span>
            ${evalResult.feedback}
          </div>
        `;

        if(evalResult.pass){
          completeWaypoint(node, evalResult.levelGain);
          showToast(`Waypoint passed - "${node.title}" marked complete.`);
        } else {
          showToast('Not quite there - see feedback and try again.');
        }
      } catch(err){
        console.error(err);
        showToast('Could not evaluate submission - check the backend is running.');
      } finally {
        setBtnLoading(completeBtn, false);
      }
    } else {
      completeWaypoint(node, 0);
      showToast(`Roadmap updated - "${node.title}" marked complete.`);
    }
  });
}

function completeWaypoint(node, levelGain){
  node.status = 'done';
  const idx = state.roadmap.findIndex(n=>n.id===node.id);
  const next = state.roadmap[idx+1];
  if(next) next.status = 'current';

  if(node.type === 'skill' && levelGain){
    const s = state.skills.find(x=>x.skill===node.skill);
    if(s){ s.level = Math.min(100, s.level + levelGain); s.have = s.level >= 55; renderSkillMap(); }
  }
  renderRoadmap();
  renderMilestonePanel();
  updateReadiness();
}

document.getElementById('toInterviewBtn').addEventListener('click', ()=>{
  renderInterview();
  unlockStep('interview');
  goto('interview');
});

function renderInterview(){
  document.getElementById('interviewSub').textContent =
    `Questions calibrated for ${state.careerLabel || cap(state.careerKey)}. Pick one to answer.`;
  const questions = INTERVIEW_QUESTIONS[state.careerKey] || INTERVIEW_QUESTIONS.default;
  const list = document.getElementById('qList');
  list.innerHTML = '';
  questions.forEach((q,i)=>{
    const answered = state.interviewAnswers[i];
    const item = document.createElement('div');
    item.className = 'q-item' + (answered ? ' answered' : '');
    item.innerHTML = `
      <div><div class="q-cat">${q.cat}</div>${q.q}</div>
      ${answered ? `<div class="score-badge">${answered.score}/10</div>` : ''}
    `;
    item.addEventListener('click', ()=>renderAnswerArea(i, q));
    list.appendChild(item);
  });
  renderWeeklyPlanSection();
}

function renderAnswerArea(i, q){
  const area = document.getElementById('answerArea');
  const prior = state.interviewAnswers[i];
  area.innerHTML = `
    <div class="card">
      <div class="field">
        <label>${q.cat} - Your answer</label>
        <textarea id="answerText" placeholder="Answer as you would in the room...">${prior ? prior.text || '' : ''}</textarea>
      </div>
      <div class="btn-row">
        <button class="btn" id="submitAnswerBtn">Submit Answer</button>
      </div>
      <div id="feedbackSlot"></div>
    </div>
  `;
  if(prior){ renderFeedback(prior); }

  const submitAnswerBtn = document.getElementById('submitAnswerBtn');
  submitAnswerBtn.addEventListener('click', async ()=>{
    const text = document.getElementById('answerText').value;
    if(!text.trim()){ showToast('Write an answer first.'); return; }

    setBtnLoading(submitAnswerBtn, true, 'Scoring…');
    try{
      const result = await apiPost('/api/score-answer', {
        question: q.q,
        category: q.cat,
        answer: text,
        careerLabel: state.careerLabel || cap(state.careerKey),
      });
      result.text = text;
      state.interviewAnswers[i] = result;
      renderFeedback(result);
      renderInterview();
      updateReadiness();
      showToast('Feedback logged - readiness score updated.');
    } catch(err){
      console.error(err);
      showToast('Could not score answer — check the backend is running.');
    } finally {
      setBtnLoading(submitAnswerBtn, false);
    }
  });
}

function renderFeedback(result){
  document.getElementById('feedbackSlot').innerHTML = `
    <div class="feedback-box">
      <span class="fb-score">Score: ${result.score}/10</span>
      ${result.note}
    </div>
  `;
}

function renderWeeklyPlanSection(){
  const list = document.getElementById('qList');
  const existing = document.getElementById('weeklyPlanSection');
  if(existing) existing.remove();

  const section = document.createElement('div');
  section.id = 'weeklyPlanSection';
  section.style.marginTop = '10px';
  section.innerHTML = `
    <div class="btn-row" style="justify-content:flex-start">
      <button class="btn secondary" id="weeklyPlanBtn">Generate Next Week's Plan →</button>
    </div>
    <div id="weeklyPlanCard"></div>
  `;
  list.parentNode.insertBefore(section, list.nextSibling);

  document.getElementById('weeklyPlanBtn').addEventListener('click', async (e)=>{
    const btn = e.currentTarget;
    setBtnLoading(btn, true, 'Planning…');
    try{
      const plan = await apiPost('/api/next-week-plan', {
        careerLabel: state.careerLabel || cap(state.careerKey),
        skills: state.skills,
        roadmap: state.roadmap,
        interviewAnswers: state.interviewAnswers,
      });
      state.weeklyPlan = plan;
      document.getElementById('weeklyPlanCard').innerHTML = `
        <div class="card" style="margin-top:14px">
          <div class="mp-title" style="margin-bottom:8px">This Week</div>
          <p class="mp-desc" style="margin:0 0 14px">${plan.summary}</p>
          <div class="field">
            <label>Focus areas</label>
            <div>${plan.focus.map(f=>`<span class="tag-chip" style="margin:0 6px 6px 0;display:inline-flex">${f}</span>`).join('')}</div>
          </div>
          <div class="field" style="margin-bottom:0">
            <label>Tasks</label>
            <ul style="margin:0;padding-left:18px;color:rgba(244,247,250,0.85);font-size:13.5px;line-height:1.7">
              ${plan.tasks.map(t=>`<li>${t}</li>`).join('')}
            </ul>
          </div>
        </div>
      `;
    } catch(err){
      console.error(err);
      showToast('Could not generate plan - check the backend is running.');
    } finally {
      setBtnLoading(btn, false);
    }
  });
}

document.querySelectorAll('[data-goto]').forEach(btn=>{
  btn.addEventListener('click', ()=>goto(btn.dataset.goto));
});
document.querySelectorAll('.step.locked').forEach(s=>{
  s.addEventListener('click', ()=>showToast('Finish the current step to unlock this one.'));
});