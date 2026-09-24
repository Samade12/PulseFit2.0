const $=s=>document.querySelector(s), $$=s=>document.querySelectorAll(s);
const state={user:null,page:"dashboard",dash:null,workouts:[],exercises:[],goals:[]};
const today=()=>new Date().toISOString().slice(0,10);
const esc=x=>String(x??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
const dateFmt=d=>new Date(d+"T00:00:00").toLocaleDateString(undefined,{month:"short",day:"numeric",year:"numeric"});
const initials=n=>n.split(/\s+/).map(x=>x[0]).join("").slice(0,2).toUpperCase();
const pct=(x,t)=>Math.min(100,Math.max(0,(Number(x)/Number(t||1))*100));
async function api(url,opt={}){const r=await fetch(url,{headers:{"Content-Type":"application/json",...(opt.headers||{})},...opt});const d=await r.json().catch(()=>({}));if(!r.ok)throw Error(d.error||"Something went wrong");return d}
function toast(msg){const t=$("#toast");t.textContent=msg;t.classList.add("show");setTimeout(()=>t.classList.remove("show"),2400)}

let login=true;
$("#auth-toggle").onclick=()=>{login=!login;$("#auth-name-wrap").classList.toggle("hidden",login);$("#auth-title").textContent=login?"Welcome back":"Create your account";$("#auth-subtitle").textContent=login?"Sign in to continue your fitness journey.":"Set up your personal fitness workspace.";$("#auth-submit").innerHTML=login?"Sign in <span>→</span>":"Create account <span>→</span>";$("#auth-toggle-text").textContent=login?"Don't have an account?":"Already registered?";$("#auth-toggle").textContent=login?"Create one":"Sign in"};
$("#auth-form").onsubmit=async e=>{e.preventDefault();try{const data=Object.fromEntries(new FormData(e.target));const r=await api(login?"/api/login":"/api/register",{method:"POST",body:JSON.stringify(data)});state.user=r.user;showApp();navigate("dashboard")}catch(err){toast(err.message)}};
function showAuth(){$("#auth-screen").classList.remove("hidden");$("#app-screen").classList.add("hidden")}
function showApp(){$("#auth-screen").classList.add("hidden");$("#app-screen").classList.remove("hidden");updateUserUI()}
function updateUserUI(){$("#side-name").textContent=state.user.name;$("#side-avatar").textContent=initials(state.user.name);$("#first-name").textContent=state.user.name.split(" ")[0];$("#settings-avatar").textContent=initials(state.user.name);$("#header-date").textContent=new Date().toLocaleDateString(undefined,{weekday:"long",month:"long",day:"numeric"});$("#set-name").value=state.user.name;$("#set-email").value=state.user.email;$("#set-height").value=state.user.height;$("#set-weight").value=state.user.weight;$("#set-goal").value=state.user.goal;$("#set-calories").value=state.user.daily_calories}
$$(".nav-link").forEach(b=>b.onclick=()=>navigate(b.dataset.page));
$$("[data-page-link]").forEach(b=>b.onclick=()=>navigate(b.dataset.pageLink));
$("#mobile-nav").onclick=()=>$("#sidebar").classList.add("open");$("#close-mobile-nav").onclick=()=>$("#sidebar").classList.remove("open");
$("#logout").onclick=async()=>{await api("/api/logout",{method:"POST"});showAuth()};
function navigate(page){state.page=page;$$(".nav-link").forEach(x=>x.classList.toggle("active",x.dataset.page===page));$$(".page").forEach(x=>x.classList.toggle("hidden",x.id!==`page-${page}`));$("#sidebar").classList.remove("open");loadPage()}
async function loadPage(){try{
 if(pageNeedsDash(state.page)){state.dash=await api("/api/dashboard");state.user=state.dash.user;updateUserUI()}
 if(state.page==="dashboard")renderDashboard();
 if(state.page==="workouts"){state.workouts=(await api("/api/workouts")).workouts;renderWorkouts()}
 if(state.page==="exercises"){await fetchExercises();renderExercises()}
 if(state.page==="progress")renderProgress();
 if(state.page==="goals")renderGoals();
 if(state.page==="settings")renderSettings();
}catch(e){if(e.message==="Unauthorized")showAuth();else toast(e.message)}}
function pageNeedsDash(p){return ["dashboard","progress","goals"].includes(p)}
function renderDashboard(){
 const d=state.dash;
 $("#metric-minutes").textContent=d.stats.minutes;$("#metric-calories").textContent=d.stats.calories;$("#metric-sessions").textContent=d.stats.sessions;$("#metric-weight").textContent=Number(state.user.weight||0).toFixed(1);
 $("#minutes-bar").style.width=Math.min(100,d.stats.minutes/240*100)+"%";$("#calories-bar").style.width=Math.min(100,d.stats.calories/2000*100)+"%";$("#sessions-bar").style.width=Math.min(100,d.stats.sessions/5*100)+"%";$("#weight-bar").style.width="75%";
 $("#streak").textContent=`${d.stats.today?"1":"0"} day`;
 $("#hero-message").textContent=d.stats.sessions?`You've logged ${d.stats.sessions} session${d.stats.sessions===1?"":"s"} in the last 7 days. Keep the rhythm going.`:"Log your first workout this week and start building momentum.";
 renderChart(d.weekly);renderDashGoals(d.goals);renderRecent(d.workouts);renderWater(d.water);
}
function renderChart(days){const max=Math.max(60,...days.map(x=>x.minutes));$("#weekly-chart").innerHTML=days.map((x,i)=>`<div class="bar ${i===6?"active":""}" style="--h:${Math.max(4,x.minutes/max*100)}%" data-value="${x.minutes}"></div>`).join("");$("#chart-days").innerHTML=days.map(x=>`<span>${new Date(x.date+"T00:00:00").toLocaleDateString(undefined,{weekday:"short"}).slice(0,2)}</span>`).join("")}
function renderDashGoals(gs){$("#dashboard-goals").innerHTML=gs.length?gs.slice(0,4).map(g=>`<div><div class="goal-line-top"><strong>${esc(g.title)}</strong><span>${Number(g.current).toFixed(g.unit==="kg"?1:0)}/${Number(g.target).toFixed(g.unit==="kg"?1:0)} ${esc(g.unit)}</span></div><div class="track"><i style="width:${pct(g.current,g.target)}%"></i></div></div>`).join(""):`<div class="goal-empty">No active goals yet.<br>Create your first milestone.</div>`}
function renderRecent(ws){$("#recent-workouts").innerHTML=ws.length?ws.slice(0,5).map(w=>`<div class="recent-item"><div class="workout-badge">${w.category==="Cardio"?"⌁":w.category==="Core"?"◉":"◆"}</div><div class="recent-main"><strong>${esc(w.name)}</strong><small>${dateFmt(w.workout_date)} · ${w.duration} min · ${esc(w.intensity)}</small></div><div class="recent-kcal"><strong>${w.calories||0}</strong><small>kcal</small></div></div>`).join(""):`<div class="goal-empty">No workouts logged yet.</div>`}
function renderWater(amount){$("#water-value").textContent=amount;$("#water-fill").style.height=Math.min(100,amount/25)+"%"}
$$("[data-water]").forEach(b=>b.onclick=async()=>{await api("/api/water",{method:"POST",body:JSON.stringify({amount:Number(b.dataset.water)})});state.dash=await api("/api/dashboard");renderWater(state.dash.water);toast("Hydration logged")});

function renderWorkouts(){
 const q=($("#workout-search").value||"").toLowerCase(),cat=$("#workout-filter").value;
 const rows=state.workouts.filter(w=>(!q||w.name.toLowerCase().includes(q))&&(cat==="All categories"||w.category===cat));
 $("#workout-count").textContent=`${rows.length} session${rows.length===1?"":"s"}`;
 $("#workout-table").innerHTML=rows.length?rows.map(w=>`<tr><td>${dateFmt(w.workout_date)}</td><td><strong>${esc(w.name)}</strong><br><span style="font-size:9px;color:#9aa39b">${esc(w.notes||"")}</span></td><td><span class="tag">${esc(w.category)}</span></td><td>${w.duration} min</td><td>${w.calories||0} kcal</td><td>${esc(w.intensity)}</td><td><button class="delete-btn" onclick="deleteWorkout(${w.id})">Delete</button></td></tr>`).join(""):`<tr><td colspan="7"><div class="goal-empty">No matching workouts.</div></td></tr>`;
}
$("#workout-search").oninput=renderWorkouts;$("#workout-filter").onchange=renderWorkouts;
async function deleteWorkout(id){if(confirm("Delete this workout?")){await api("/api/workouts/"+id,{method:"DELETE"});toast("Workout deleted");loadPage()}}

async function fetchExercises(){const q=$("#exercise-search").value||"",c=$("#exercise-category").value,d=$("#exercise-difficulty").value;state.exercises=(await api(`/api/exercises?q=${encodeURIComponent(q)}&category=${encodeURIComponent(c)}&difficulty=${encodeURIComponent(d)}`)).exercises}
function renderExercises(){$("#exercise-total").textContent=state.exercises.length;$("#exercise-grid").innerHTML=state.exercises.map(e=>`<article class="exercise-card"><div class="exercise-top"><div><span class="exercise-category">${esc(e.category)}</span><h3>${esc(e.name)}</h3></div></div><div class="exercise-meta"><span>${esc(e.muscle)}</span><span>${esc(e.equipment)}</span><span>${esc(e.difficulty)}</span></div><p>${esc(e.instructions)}</p><div class="prescription"><span>Suggested volume</span><strong>${e.sets} × ${esc(e.reps)}</strong></div></article>`).join("")||`<article class="panel goal-empty">No movements found.</article>`}
let exTimer;$("#exercise-search").oninput=()=>{clearTimeout(exTimer);exTimer=setTimeout(async()=>{await fetchExercises();renderExercises()},180)};$("#exercise-category").onchange=async()=>{await fetchExercises();renderExercises()};$("#exercise-difficulty").onchange=async()=>{await fetchExercises();renderExercises()};

function renderProgress(){const d=state.dash,ws=d.weights||[],current=Number(state.user.weight||0),start=ws.length?Number(ws[0].weight):current,change=current-start;$("#progress-weight").textContent=current.toFixed(1)+" kg";$("#start-weight").textContent=start.toFixed(1)+" kg";$("#weight-change").textContent=(change>0?"+":"")+change.toFixed(1)+" kg";const bmi=Number(state.user.height)?current/(Number(state.user.height)/100)**2:0;$("#bmi").textContent=bmi.toFixed(1);$("#weight-history").innerHTML=ws.slice(-8).reverse().map(w=>`<div class="history-item"><span>${dateFmt(w.log_date)}</span><strong>${Number(w.weight).toFixed(1)} kg</strong></div>`).join("")||`<div class="goal-empty">No measurements yet.</div>`;drawWeightChart(ws)}
function drawWeightChart(ws){const box=$("#weight-chart");if(!ws.length){box.innerHTML=`<div class="goal-empty" style="width:100%">Log a few measurements to see your trend.</div>`;return}const vals=ws.slice(-30),min=Math.min(...vals.map(x=>x.weight)),max=Math.max(...vals.map(x=>x.weight)),range=max-min||1,w=700,h=230,p=18;let points=vals.map((x,i)=>{const px=p+i/(Math.max(1,vals.length-1))*(w-p*2),py=h-p-(x.weight-min)/range*(h-p*2);return [px,py]}),path=points.map((p,i)=>(i?"L":"M")+p[0].toFixed(1)+" "+p[1].toFixed(1)).join(" ");box.innerHTML=`<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none"><path d="${path}" fill="none" stroke="#3f7b50" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>${points.map(p=>`<circle cx="${p[0]}" cy="${p[1]}" r="3.5" fill="#fff" stroke="#3f7b50" stroke-width="2"/>`).join("")}</svg>`}

function renderGoals(){const gs=state.dash.goals;$("#goals-grid").innerHTML=gs.length?gs.map(g=>`<article class="goal-card"><div class="goal-card-top"><div><span class="eyebrow">${g.completed?"COMPLETED":"ACTIVE"}</span><h3>${esc(g.title)}</h3></div><button class="goal-delete" onclick="deleteGoal(${g.id})">×</button></div><div class="goal-number">${Number(g.current).toFixed(g.unit==="kg"?1:0)} <small>${esc(g.unit)}</small></div><div class="goal-target">Target: ${Number(g.target).toFixed(g.unit==="kg"?1:0)} ${esc(g.unit)}</div><div class="track"><i style="width:${pct(g.current,g.target)}%"></i></div><div class="goal-actions"><button onclick="incrementGoal(${g.id},${g.current},${g.target})">+1</button><button onclick="completeGoal(${g.id},${g.target})">Complete</button></div>${g.deadline?`<div class="goal-date">Deadline · ${dateFmt(g.deadline)}</div>`:""}</article>`).join(""):`<article class="panel goal-empty">No goals yet. Create your first measurable milestone.</article>`}
async function incrementGoal(id,c,t){await api("/api/goals/"+id,{method:"PUT",body:JSON.stringify({current:Number(c)+1,target:Number(t)})});toast("Goal updated");loadPage()}
async function completeGoal(id,t){await api("/api/goals/"+id,{method:"PUT",body:JSON.stringify({current:t,target:t})});toast("Goal completed");loadPage()}
async function deleteGoal(id){if(confirm("Delete this goal?")){await api("/api/goals/"+id,{method:"DELETE"});toast("Goal deleted");loadPage()}}

function renderSettings(){updateUserUI()}
$$("[data-open]").forEach(b=>b.onclick=()=>openModal(b.dataset.open));
function openModal(type){const id="#"+type+"-modal";$(id).classList.remove("hidden");if(type==="workout")$("#workout-date").value=today();if(type==="weight"){ $("#weight-date").value=today();$("#weight-form input[name=weight]").value=state.user.weight}}
$$(".modal-close,.modal-cancel").forEach(b=>b.onclick=()=>$$(".modal-backdrop").forEach(m=>m.classList.add("hidden")));
$("#workout-form").onsubmit=async e=>{e.preventDefault();try{await api("/api/workouts",{method:"POST",body:JSON.stringify(Object.fromEntries(new FormData(e.target)))});closeAll();e.target.reset();toast("Workout saved");navigate(state.page)}catch(err){toast(err.message)}};
$("#weight-form").onsubmit=async e=>{e.preventDefault();try{await api("/api/weights",{method:"POST",body:JSON.stringify(Object.fromEntries(new FormData(e.target)))});closeAll();toast("Weight saved");navigate("progress")}catch(err){toast(err.message)}};
$("#goal-form").onsubmit=async e=>{e.preventDefault();try{await api("/api/goals",{method:"POST",body:JSON.stringify(Object.fromEntries(new FormData(e.target)))});closeAll();e.target.reset();toast("Goal created");navigate("goals")}catch(err){toast(err.message)}};
function closeAll(){$$(".modal-backdrop").forEach(m=>m.classList.add("hidden"))}
$("#settings-form").onsubmit=async e=>{e.preventDefault();try{const data=Object.fromEntries(new FormData(e.target));const r=await api("/api/me",{method:"PUT",body:JSON.stringify(data)});state.user=r.user;updateUserUI();toast("Profile updated")}catch(err){toast(err.message)}};

(async()=>{try{state.user=(await api("/api/me")).user;showApp();navigate("dashboard")}catch{showAuth()}})();