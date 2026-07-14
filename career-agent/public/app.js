
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

function analyzeSkills(resumeText, careerKey){
  const required = CAREER_SKILLS[careerKey];
  const text = resumeText.toLowerCase();
  return required.map(skill => {
    const found = text.includes(skill.toLowerCase()) ||
                  (skill === "machine learning" && text.includes("ml")) ||
                  (skill === "data visualization" && (text.includes("tableau")||text.includes("dashboard")));
    return { skill, level: found ? (60 + Math.floor(Math.random()*30)) : (5 + Math.floor(Math.random()*20)), have: found };
  });
}

function buildRoadmap(skills){
  const gaps = skills.filter(s => !s.have).map(s => s.skill);
  const solid = skills.filter(s => s.have).map(s => s.skill);
  const nodes = gaps.map(s => ({ type:"skill", skill:s, title:`Close the gap: ${cap(s)}` }));
  if(nodes.length < 2 && solid.length){
    nodes.push({type:"skill", skill:solid[0], title:`Deepen: ${cap(solid[0])}`});
  }
  nodes.push({ type:"interview", title:"Mock Interview Prep" });
  nodes.push({ type:"capstone", title:"Capstone Project" });
  return nodes.slice(0,6).map((n,i)=>({
    ...n,
    id:i,
    status: i===0 ? "current" : "locked"
  }));
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

function scoreAnswer(text){
  const len = text.trim().split(/\s+/).filter(Boolean).length;
  const hasResult = /result|outcome|impact|improved|reduced|increased/i.test(text);
  const hasExample = /for example|when i|in my|at my|i worked|i built|i led/i.test(text);
  let score = 4;
  if(len > 25) score += 2;
  if(len > 60) score += 1;
  if(hasExample) score += 1.5;
  if(hasResult) score += 1.5;
  score = Math.min(10, Math.round(score*10)/10);
  let note;
  if(score >= 8) note = "Strong answer — concrete example and a clear result. Keep answers this tight.";
  else if(score >= 6) note = "Solid structure. Add a specific, measurable result to make it land harder.";
  else note = "Too thin for a panel interview. Use a real example and name the outcome (STAR format helps).";
  return {score, note};
}

function cap(s){ return s.charAt(0).toUpperCase()+s.slice(1); }

const state = {
  interests: [],
  careerKey: "default",
  careerLabel: "",
  skills: [],
  roadmap: [],
  selectedNode: null,
  interviewAnswers: {},
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
  showToast._t = setTimeout(()=>els.toast.classList.remove('show'), 2400);
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

/* --- step 1: analyze --- */
document.getElementById('analyzeBtn').addEventListener('click', ()=>{
  const resume = document.getElementById('resumeInput').value;
  const targetRaw = document.getElementById('targetInput').value || 'General role';
  state.careerLabel = targetRaw;
  state.careerKey = normalizeCareer(targetRaw);
  state.skills = analyzeSkills(resume, state.careerKey);

  renderSkillMap();
  unlockStep('skillmap');
  goto('skillmap');
  updateReadiness();
});

function renderSkillMap(){
  document.getElementById('skillmapSub').textContent =
    `Target: ${state.careerLabel || cap(state.careerKey)}. ${state.skills.filter(s=>!s.have).length} of ${state.skills.length} core skills still need work.`;
  const list = document.getElementById('skillList');
  list.innerHTML = '';
  state.skills.forEach(s=>{
    const row = document.createElement('div');
    row.className = 'skill-row';
    row.innerHTML = `
      <div class="skill-name">${cap(s.skill)}</div>
      <div class="skill-track"><div class="skill-fill ${s.have?'have':'gap'}" style="width:0%"></div></div>
      <div class="skill-pct">${s.level}%</div>
    `;
    list.appendChild(row);
    requestAnimationFrame(()=>{
      row.querySelector('.skill-fill').style.width = s.level + '%';
    });
  });
}

/* --- step 2 -> 3: build roadmap --- */
document.getElementById('buildRoadmapBtn').addEventListener('click', ()=>{
  state.roadmap = buildRoadmap(state.skills);
  renderRoadmap();
  unlockStep('roadmap');
  goto('roadmap');
  showToast('Roadmap drafted from your skill gaps.');
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

  const desc = node.type === 'skill'
    ? `Focused sprint to build real, demonstrable proficiency in ${node.skill}. Ship the projects below, then mark this complete to update your skill map.`
    : node.type === 'interview'
    ? `Prep block before your mock interview. Review common questions for ${state.careerLabel || cap(state.careerKey)} and rehearse out loud.`
    : `A capstone that ties your closed gaps together into one portfolio-ready piece.`;

  const projects = node.type === 'skill' ? projectsFor(node.skill) : projectsFor(state.careerKey === 'default' ? 'communication' : CAREER_SKILLS[state.careerKey][0]);

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
    <div class="btn-row" style="justify-content:flex-start">
      <button class="btn" id="completeBtn" ${node.status!=='current'?'disabled':''}>Mark Waypoint Complete</button>
    </div>
  `;

  const completeBtn = document.getElementById('completeBtn');
  if(completeBtn){
    completeBtn.addEventListener('click', ()=>{
      node.status = 'done';
      const idx = state.roadmap.findIndex(n=>n.id===node.id);
      const next = state.roadmap[idx+1];
      if(next) next.status = 'current';

      if(node.type === 'skill'){
        const s = state.skills.find(x=>x.skill===node.skill);
        if(s){ s.level = Math.min(100, s.level + 35); s.have = s.level >= 55; renderSkillMap(); }
      }
      renderRoadmap();
      renderMilestonePanel();
      updateReadiness();
      showToast(`Roadmap updated - "${node.title}" marked complete.`);
    });
  }
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

  document.getElementById('submitAnswerBtn').addEventListener('click', ()=>{
    const text = document.getElementById('answerText').value;
    if(!text.trim()){ showToast('Write an answer first.'); return; }
    const result = scoreAnswer(text);
    result.text = text;
    state.interviewAnswers[i] = result;
    renderFeedback(result);
    renderInterview();
    updateReadiness();
    showToast('Feedback logged — readiness score updated.');
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

document.querySelectorAll('[data-goto]').forEach(btn=>{
  btn.addEventListener('click', ()=>goto(btn.dataset.goto));
});
document.querySelectorAll('.step.locked').forEach(s=>{
  s.addEventListener('click', ()=>showToast('Finish the current step to unlock this one.'));
});