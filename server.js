import express from "express";
import cookieParser from "cookie-parser";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __dirname=path.dirname(fileURLToPath(import.meta.url));
const app=express();
const PORT=process.env.PORT||3000;
const SECRET=process.env.JWT_SECRET||"pulsefit-development-secret-change-me";
const db=new Database(path.join(__dirname,"pulsefit.db"));
db.pragma("journal_mode=WAL");
db.exec(`
CREATE TABLE IF NOT EXISTS users(
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 name TEXT NOT NULL,email TEXT UNIQUE NOT NULL,password_hash TEXT NOT NULL,
 height REAL DEFAULT 175,weight REAL DEFAULT 75,goal TEXT DEFAULT 'Build strength',
 daily_calories INTEGER DEFAULT 2200,created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS workouts(
 id INTEGER PRIMARY KEY AUTOINCREMENT,user_id INTEGER NOT NULL,name TEXT NOT NULL,
 category TEXT NOT NULL,duration INTEGER NOT NULL,calories INTEGER DEFAULT 0,
 intensity TEXT DEFAULT 'Moderate',workout_date TEXT NOT NULL,notes TEXT DEFAULT '',
 FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS exercises(
 id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT NOT NULL,category TEXT NOT NULL,
 muscle TEXT NOT NULL,equipment TEXT NOT NULL,difficulty TEXT NOT NULL,
 instructions TEXT NOT NULL,sets INTEGER DEFAULT 3,reps TEXT DEFAULT '8-12'
);
CREATE TABLE IF NOT EXISTS weights(
 id INTEGER PRIMARY KEY AUTOINCREMENT,user_id INTEGER NOT NULL,weight REAL NOT NULL,
 log_date TEXT NOT NULL,FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS goals(
 id INTEGER PRIMARY KEY AUTOINCREMENT,user_id INTEGER NOT NULL,title TEXT NOT NULL,
 target REAL NOT NULL,current REAL DEFAULT 0,unit TEXT NOT NULL,deadline TEXT DEFAULT '',
 completed INTEGER DEFAULT 0,FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS water(
 id INTEGER PRIMARY KEY AUTOINCREMENT,user_id INTEGER NOT NULL,amount INTEGER NOT NULL,
 log_date TEXT NOT NULL,FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);
`);

if(db.prepare("SELECT COUNT(*) c FROM exercises").get().c===0){
 const add=db.prepare(`INSERT INTO exercises
 (name,category,muscle,equipment,difficulty,instructions,sets,reps) VALUES(?,?,?,?,?,?,?,?)`);
 [
  ["Barbell Back Squat","Strength","Quads & Glutes","Barbell","Intermediate","Brace your core, sit your hips down and back, keep your knees tracking over your toes, then drive through the floor.","4","6-10"],
  ["Bench Press","Strength","Chest","Barbell","Intermediate","Retract your shoulders, keep your feet planted and lower the bar under control to mid-chest.","4","6-10"],
  ["Deadlift","Strength","Posterior Chain","Barbell","Advanced","Hinge at the hips, keep the bar close to your legs and stand tall without leaning backward.","3","5-8"],
  ["Pull Up","Strength","Back & Biceps","Pull-up Bar","Intermediate","Start from a controlled hang and pull your chest toward the bar while keeping your ribs down.","4","6-12"],
  ["Dumbbell Row","Strength","Back","Dumbbells","Beginner","Support yourself with one hand, brace your trunk and pull the dumbbell toward your hip.","3","8-12"],
  ["Shoulder Press","Strength","Shoulders","Dumbbells","Beginner","Press overhead while keeping your wrists stacked and your ribs controlled.","3","8-12"],
  ["Walking Lunge","Strength","Legs","Bodyweight","Beginner","Step forward, lower your back knee toward the floor and push through the front foot.","3","10-14"],
  ["Romanian Deadlift","Strength","Hamstrings","Dumbbells","Intermediate","Push your hips backward while keeping a soft knee bend and a neutral spine.","3","8-12"],
  ["Plank","Core","Core","Bodyweight","Beginner","Brace your abs, squeeze your glutes and keep your head, hips and heels aligned.","3","30-60 sec"],
  ["Bicycle Crunch","Core","Abs","Bodyweight","Beginner","Rotate your torso and bring the opposite elbow toward the knee without pulling on your neck.","3","12-20"],
  ["Mountain Climbers","Cardio","Full Body","Bodyweight","Intermediate","Maintain a strong plank while alternating your knees toward your chest at a steady pace.","4","30-45 sec"],
  ["Jump Rope","Cardio","Full Body","Jump Rope","Intermediate","Use small relaxed jumps and turn the rope with your wrists rather than your shoulders.","5","60 sec"],
  ["Burpees","Cardio","Full Body","Bodyweight","Advanced","Lower to a squat, place your hands down, step or jump back, return and stand tall.","4","8-15"],
  ["Jumping Jacks","Cardio","Full Body","Bodyweight","Beginner","Jump your feet apart while raising your arms, then return to the starting position.","4","30-60 sec"],
  ["Glute Bridge","Strength","Glutes","Bodyweight","Beginner","Drive through your heels, squeeze your glutes at the top and lower slowly.","3","12-20"],
  ["Hip Flexor Stretch","Mobility","Hips","Bodyweight","Beginner","Kneel with one foot forward and gently shift your hips forward without arching your lower back.","3","30 sec/side"]
 ].forEach(x=>add.run(...x));
}
const today=()=>new Date().toISOString().slice(0,10);
function auth(req,res,next){try{req.user=jwt.verify(req.cookies.pulsefit,SECRET);next()}catch{res.status(401).json({error:"Unauthorized"})}}
function setLogin(res,u){res.cookie("pulsefit",jwt.sign({id:u.id},SECRET,{expiresIn:"7d"}),{httpOnly:true,sameSite:"lax",secure:process.env.NODE_ENV==="production",maxAge:604800000})}

app.use(express.json());app.use(cookieParser());app.use(express.static(path.join(__dirname,"public")));

app.post("/api/register",(req,res)=>{
 const {name,email,password}=req.body;
 if(!name||!email||!password||password.length<6)return res.status(400).json({error:"Use a name, email and password of at least 6 characters."});
 try{
  const hash=bcrypt.hashSync(password,10);
  const r=db.prepare("INSERT INTO users(name,email,password_hash) VALUES(?,?,?)").run(name.trim(),email.trim().toLowerCase(),hash);
  const u=db.prepare("SELECT * FROM users WHERE id=?").get(r.lastInsertRowid);
  db.prepare("INSERT INTO weights(user_id,weight,log_date) VALUES(?,?,?)").run(u.id,u.weight,today());
  db.prepare("INSERT INTO goals(user_id,title,target,current,unit,deadline) VALUES(?,?,?,?,?,?)").run(u.id,"Weekly training",4,0,"sessions",today());
  setLogin(res,u);res.json({user:safeUser(u)});
 }catch{res.status(409).json({error:"An account with that email already exists."})}
});
app.post("/api/login",(req,res)=>{
 const u=db.prepare("SELECT * FROM users WHERE email=?").get((req.body.email||"").trim().toLowerCase());
 if(!u||!bcrypt.compareSync(req.body.password||"",u.password_hash))return res.status(401).json({error:"Invalid email or password."});
 setLogin(res,u);res.json({user:safeUser(u)});
});
app.post("/api/logout",(req,res)=>{res.clearCookie("pulsefit");res.json({ok:true})});
function safeUser(u){return {id:u.id,name:u.name,email:u.email,height:u.height,weight:u.weight,goal:u.goal,daily_calories:u.daily_calories}}

app.get("/api/me",auth,(req,res)=>res.json({user:safeUser(db.prepare("SELECT * FROM users WHERE id=?").get(req.user.id))}));
app.put("/api/me",auth,(req,res)=>{
 const {name,height,weight,goal,daily_calories}=req.body;
 db.prepare("UPDATE users SET name=?,height=?,weight=?,goal=?,daily_calories=? WHERE id=?")
 .run(name,height,weight,goal,daily_calories,req.user.id);
 res.json({user:safeUser(db.prepare("SELECT * FROM users WHERE id=?").get(req.user.id))});
});

app.get("/api/dashboard",auth,(req,res)=>{
 const uid=req.user.id;
 const start=new Date();start.setDate(start.getDate()-6);const startDate=start.toISOString().slice(0,10);
 const workouts=db.prepare("SELECT * FROM workouts WHERE user_id=? AND workout_date>=? ORDER BY workout_date DESC,id DESC").all(uid,startDate);
 const allWorkouts=db.prepare("SELECT * FROM workouts WHERE user_id=? ORDER BY workout_date DESC,id DESC LIMIT 100").all(uid);
 const weights=db.prepare("SELECT * FROM weights WHERE user_id=? ORDER BY log_date ASC,id ASC LIMIT 90").all(uid);
 const goals=db.prepare("SELECT * FROM goals WHERE user_id=? ORDER BY completed ASC,id DESC").all(uid);
 const water=db.prepare("SELECT amount FROM water WHERE user_id=? AND log_date=?").all(uid,today()).reduce((a,x)=>a+x.amount,0);
 const weekDays=[...Array(7)].map((_,i)=>{const d=new Date();d.setDate(d.getDate()-(6-i));return d.toISOString().slice(0,10)});
 const weekly=weekDays.map(date=>({date,minutes:workouts.filter(w=>w.workout_date===date).reduce((a,w)=>a+w.duration,0),calories:workouts.filter(w=>w.workout_date===date).reduce((a,w)=>a+w.calories,0),sessions:workouts.filter(w=>w.workout_date===date).length}));
 const recent=allWorkouts.slice(0,8);
 const totalMinutes=workouts.reduce((a,w)=>a+w.duration,0),totalCalories=workouts.reduce((a,w)=>a+w.calories,0);
 res.json({user:safeUser(db.prepare("SELECT * FROM users WHERE id=?").get(uid)),workouts:recent,weights,goals,water,weekly,
  stats:{minutes:totalMinutes,calories:totalCalories,sessions:workouts.length,today:workouts.filter(w=>w.workout_date===today()).length}});
});

app.get("/api/workouts",auth,(req,res)=>{
 res.json({workouts:db.prepare("SELECT * FROM workouts WHERE user_id=? ORDER BY workout_date DESC,id DESC").all(req.user.id)});
});
app.post("/api/workouts",auth,(req,res)=>{
 const {name,category,duration,calories,intensity,date,notes}=req.body;
 if(!name||!duration||!date)return res.status(400).json({error:"Name, duration and date are required."});
 const r=db.prepare(`INSERT INTO workouts(user_id,name,category,duration,calories,intensity,workout_date,notes)
 VALUES(?,?,?,?,?,?,?,?)`).run(req.user.id,name,category||"Strength",Number(duration),Number(calories||0),intensity||"Moderate",date,notes||"");
 res.json({workout:db.prepare("SELECT * FROM workouts WHERE id=?").get(r.lastInsertRowid)});
});
app.delete("/api/workouts/:id",auth,(req,res)=>{db.prepare("DELETE FROM workouts WHERE id=? AND user_id=?").run(req.params.id,req.user.id);res.json({ok:true})});

app.get("/api/exercises",auth,(req,res)=>{
 let sql="SELECT * FROM exercises WHERE 1=1",a=[],q=(req.query.q||"").trim(),c=req.query.category||"All",m=req.query.muscle||"All",d=req.query.difficulty||"All";
 if(q){sql+=" AND (name LIKE ? OR muscle LIKE ? OR equipment LIKE ?)";a.push(`%${q}%`,`%${q}%`,`%${q}%`)}
 if(c!=="All") {sql+=" AND category=?";a.push(c)}
 if(m!=="All") {sql+=" AND muscle=?";a.push(m)}
 if(d!=="All") {sql+=" AND difficulty=?";a.push(d)}
 res.json({exercises:db.prepare(sql+" ORDER BY name").all(...a)});
});

app.post("/api/weights",auth,(req,res)=>{
 const w=Number(req.body.weight);if(!w)return res.status(400).json({error:"Enter a valid weight."});
 const date=req.body.date||today();db.prepare("INSERT INTO weights(user_id,weight,log_date) VALUES(?,?,?)").run(req.user.id,w,date);
 db.prepare("UPDATE users SET weight=? WHERE id=?").run(w,req.user.id);res.json({ok:true});
});
app.get("/api/goals",auth,(req,res)=>res.json({goals:db.prepare("SELECT * FROM goals WHERE user_id=? ORDER BY completed ASC,id DESC").all(req.user.id)}));
app.post("/api/goals",auth,(req,res)=>{
 const {title,target,unit,deadline}=req.body;if(!title||!target||!unit)return res.status(400).json({error:"Complete the goal fields."});
 const r=db.prepare("INSERT INTO goals(user_id,title,target,current,unit,deadline) VALUES(?,?,?,?,?,?)").run(req.user.id,title,Number(target),0,unit,deadline||"");
 res.json({goal:db.prepare("SELECT * FROM goals WHERE id=?").get(r.lastInsertRowid)});
});
app.put("/api/goals/:id",auth,(req,res)=>{
 const target=Number(req.body.target),current=Math.min(Number(req.body.current),target),completed=current>=target?1:0;
 db.prepare("UPDATE goals SET current=?,completed=? WHERE id=? AND user_id=?").run(current,completed,req.params.id,req.user.id);
 res.json({ok:true});
});
app.delete("/api/goals/:id",auth,(req,res)=>{db.prepare("DELETE FROM goals WHERE id=? AND user_id=?").run(req.params.id,req.user.id);res.json({ok:true})});
app.post("/api/water",auth,(req,res)=>{db.prepare("INSERT INTO water(user_id,amount,log_date) VALUES(?,?,?)").run(req.user.id,Number(req.body.amount||250),today());res.json({ok:true})});

app.get("*",(req,res)=>res.sendFile(path.join(__dirname,"public","index.html")));
app.listen(PORT,()=>console.log(`PulseFit running at http://localhost:${PORT}`));