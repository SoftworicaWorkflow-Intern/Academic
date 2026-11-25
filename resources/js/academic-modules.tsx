import React, { useEffect, useState } from "react";
import { api as http } from "./api";

function toInstitution(path: string): string {
  if (path.startsWith("/api/")) {
    return path;
  }
  return `/api/institution${path.startsWith("/") ? path : `/${path}`}`;
}

const api = {
  get: (path: string, config?: object) => http.get(toInstitution(path), config),
  post: (path: string, data?: unknown, config?: object) => http.post(toInstitution(path), data, config),
  patch: (path: string, data?: unknown, config?: object) => http.patch(toInstitution(path), data, config),
  delete: (path: string, config?: object) => http.delete(toInstitution(path), config),
};

function asRows(payload: unknown): AnyRow[] {
  if (Array.isArray(payload)) {
    return payload;
  }
  if (payload && typeof payload === "object" && Array.isArray((payload as { data?: unknown }).data)) {
    return (payload as { data: AnyRow[] }).data;
  }
  return [];
}

type AnyRow = Record<string, any>;

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block text-sm"><span className="mb-1 block font-medium text-slate-700">{label}</span>{children}</label>;
}
const inputCls = "w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-sky-500";
function Input(props: React.InputHTMLAttributes<HTMLInputElement>) { return <input {...props} className={`${inputCls} ${props.className ?? ""}`} />; }
function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) { return <select {...props} className={`${inputCls} ${props.className ?? ""}`} />; }
function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) { return <textarea {...props} className={`${inputCls} ${props.className ?? ""}`} />; }
function Btn({ children, tone = "primary", ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { tone?: "primary" | "ghost" | "danger" }) {
  const cls = tone === "primary" ? "bg-blue-700 text-white hover:bg-blue-800" : tone === "danger" ? "bg-rose-600 text-white hover:bg-rose-700" : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50";
  return <button {...props} className={`rounded-xl px-3 py-2 text-sm font-medium disabled:opacity-50 ${cls} ${props.className ?? ""}`}>{children}</button>;
}
function Modal({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: React.ReactNode }) {
  if (!open) return null;
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"><div className="max-h-[92vh] w-full max-w-5xl overflow-auto rounded-2xl bg-white p-5 shadow-xl"><div className="mb-4 flex items-center justify-between gap-3"><h3 className="text-lg font-semibold text-slate-900">{title}</h3><button onClick={onClose} className="rounded-lg px-2 py-1 text-slate-500 hover:bg-slate-100">✕</button></div>{children}</div></div>;
}
function Card({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="mb-3 flex flex-wrap items-center justify-between gap-3"><h3 className="text-base font-semibold text-slate-900">{title}</h3>{action}</div>{children}</section>;
}
function Table({ cols, rows }: { cols: string[]; rows: React.ReactNode[][] }) {
  return <div className="overflow-auto"><table className="min-w-full text-left text-sm"><thead><tr className="border-b border-slate-200 text-slate-500">{cols.map(c => <th key={c} className="px-2 py-2 font-medium whitespace-nowrap">{c}</th>)}</tr></thead><tbody>{rows.length ? rows.map((r, i) => <tr key={i} className="border-b border-slate-100 align-top">{r.map((c, j) => <td key={j} className="px-2 py-2">{c}</td>)}</tr>) : <tr><td className="px-2 py-6 text-center text-slate-500" colSpan={cols.length}>No records found.</td></tr>}</tbody></table></div>;
}
function Page({ title, subtitle, children, action }: { title: string; subtitle: string; children: React.ReactNode; action?: React.ReactNode }) {
  return <div className="space-y-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><h1 className="text-2xl font-semibold text-slate-900">{title}</h1><p className="text-sm text-slate-500">{subtitle}</p></div>{action}</div>{children}</div>;
}
function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="text-sm text-slate-500">{label}</div><div className="mt-1 text-2xl font-semibold text-slate-900">{value}</div></div>;
}
const errMsg = (e: any) => e?.response?.data?.message || Object.values(e?.response?.data?.errors || {}).flat().join(" ") || "Request failed.";

export function AcademicSessionsPage() {
  const [rows, setRows] = useState<AnyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<AnyRow | null>(null);
  const [form, setForm] = useState<any>({ name: "", code: "", starts_on: "", ends_on: "", registration_starts_on: "", registration_ends_on: "", description: "", status: "active", is_current: false });
  const load = async () => { setLoading(true); try { const res = await api.get("/academic-sessions", { params: { per_page: 100 } }); setRows(asRows(res.data)); } catch (e: any) { setMsg(errMsg(e)); } finally { setLoading(false); } };
  useEffect(() => { load(); }, []);
  const openNew = () => { setEditing(null); setForm({ name: "", code: "", starts_on: "", ends_on: "", registration_starts_on: "", registration_ends_on: "", description: "", status: "active", is_current: false }); setOpen(true); };
  const openEdit = (r: AnyRow) => { setEditing(r); setForm({ name: r.name ?? "", code: r.code ?? "", starts_on: r.starts_on?.slice(0,10) ?? "", ends_on: r.ends_on?.slice(0,10) ?? "", registration_starts_on: r.registration_starts_on?.slice(0,10) ?? "", registration_ends_on: r.registration_ends_on?.slice(0,10) ?? "", description: r.description ?? "", status: r.status ?? "active", is_current: !!r.is_current }); setOpen(true); };
  const save = async () => { setMsg(""); try { if (editing) await api.patch(`/academic-sessions/${editing.id}`, form); else await api.post("/academic-sessions", form); setOpen(false); await load(); } catch (e: any) { setMsg(errMsg(e)); } };
  const act = async (fn: () => Promise<any>) => { setMsg(""); try { await fn(); await load(); } catch (e: any) { setMsg(errMsg(e)); } };
  return <Page title="Academic Sessions" subtitle="Create and manage academic years, set the current session, and archive old sessions." action={<Btn onClick={openNew}>+ Add Academic Session</Btn>}>
    {msg && <div className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{msg}</div>}
    <div className="grid gap-3 sm:grid-cols-4"><Stat label="Total Academic Sessions" value={rows.length} /><Stat label="Active Sessions" value={rows.filter(r => r.status === "active" || r.is_current).length} /><Stat label="Upcoming Sessions" value={rows.filter(r => r.status === "upcoming").length} /><Stat label="Completed Sessions" value={rows.filter(r => r.status === "completed" || r.status === "archived").length} /></div>
    <Card title="Academic Sessions">{loading ? <div className="text-sm text-slate-500">Loading...</div> : <Table cols={["Session Name","Start Date","End Date","Total Classes","Total Students","Status","Actions"]} rows={rows.map(r => [
      r.name, r.starts_on?.slice(0,10) || "-", r.ends_on?.slice(0,10) || "-", String(r.school_classes_count ?? 0), String(r.student_enrollments_count ?? 0), <span className={`rounded-full px-2 py-1 text-xs ${r.is_current || r.status==="active"?"bg-emerald-50 text-emerald-700":r.status==="archived"||r.status==="completed"?"bg-slate-100 text-slate-700":"bg-amber-50 text-amber-700"}`}>{r.is_current ? "Current" : r.status}</span>,
      <div className="flex flex-wrap gap-2"><Btn tone="ghost" onClick={() => openEdit(r)}>Edit</Btn>{!r.is_current && r.status!=="archived" && <Btn tone="ghost" onClick={() => act(() => api.post(`/academic-sessions/${r.id}/set-current`))}>Set Current</Btn>}{r.status!=="archived" && <Btn tone="danger" onClick={() => act(() => api.post(`/academic-sessions/${r.id}/archive`))}>Archive</Btn>}</div>
    ])} />}</Card>
    <Modal open={open} title={editing ? "Edit Academic Session" : "Add Academic Session"} onClose={() => setOpen(false)}>
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Session Name"><Input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} /></Field>
        <Field label="Session Code"><Input value={form.code} onChange={e=>setForm({...form,code:e.target.value})} /></Field>
        <Field label="Start Date"><Input type="date" value={form.starts_on} onChange={e=>setForm({...form,starts_on:e.target.value})} /></Field>
        <Field label="End Date"><Input type="date" value={form.ends_on} onChange={e=>setForm({...form,ends_on:e.target.value})} /></Field>
        <Field label="Registration Start"><Input type="date" value={form.registration_starts_on} onChange={e=>setForm({...form,registration_starts_on:e.target.value})} /></Field>
        <Field label="Registration End"><Input type="date" value={form.registration_ends_on} onChange={e=>setForm({...form,registration_ends_on:e.target.value})} /></Field>
        <Field label="Status"><Select value={form.status} onChange={e=>setForm({...form,status:e.target.value})}><option value="active">Active</option><option value="inactive">Inactive</option><option value="archived">Archived</option></Select></Field>
        <label className="flex items-center gap-2 pt-7 text-sm"><input type="checkbox" checked={form.is_current} onChange={e=>setForm({...form,is_current:e.target.checked})} /> Set as current session</label>
        <div className="md:col-span-2"><Field label="Description"><Textarea rows={3} value={form.description} onChange={e=>setForm({...form,description:e.target.value})} /></Field></div>
      </div>
      <div className="mt-4 flex justify-end gap-2"><Btn tone="ghost" onClick={()=>setOpen(false)}>Cancel</Btn><Btn onClick={save}>Save Session</Btn></div>
    </Modal>
  </Page>;
}

export function ClassesSectionsPage() {
  const [classes, setClasses] = useState<AnyRow[]>([]);
  const [sessions, setSessions] = useState<AnyRow[]>([]);
  const [teachers, setTeachers] = useState<AnyRow[]>([]);
  const [enrollments, setEnrollments] = useState<AnyRow[]>([]);
  const [msg, setMsg] = useState("");
  const [classOpen, setClassOpen] = useState(false); const [sectionOpen, setSectionOpen] = useState(false);
  const [editingClass, setEditingClass] = useState<AnyRow|null>(null); const [editingSection, setEditingSection] = useState<AnyRow|null>(null);
  const [classForm, setClassForm] = useState<any>({ name:"", code:"", academic_session_id:"", level_order:"", description:"", status:"active" });
  const [sectionForm, setSectionForm] = useState<any>({ school_class_id:"", academic_session_id:"", name:"", code:"", capacity:"", teacher_id:"", room_number:"", status:"active" });
  const [filter, setFilter] = useState({ academic_session_id:"", school_class_id:"" });
  const load = async () => {
    try {
      const [c,s,t,e] = await Promise.all([api.get("/classes"), api.get("/academic-sessions"), api.get("/teachers?per_page=100"), api.get("/student-enrollments",{params:{academic_session_id:filter.academic_session_id||undefined, school_class_id:filter.school_class_id||undefined}})]);
      setClasses(asRows(c.data)); setSessions(asRows(s.data)); setTeachers(asRows(t.data)); setEnrollments(asRows(e.data));
    } catch (e:any) { setMsg(errMsg(e)); }
  };
  useEffect(() => { load(); }, [filter.academic_session_id, filter.school_class_id]);
  const saveClass = async () => { try { const payload = {...classForm, level_order: classForm.level_order===""?null:Number(classForm.level_order), academic_session_id: classForm.academic_session_id||null}; editingClass ? await api.patch(`/classes/${editingClass.id}`, payload) : await api.post("/classes", payload); setClassOpen(false); load(); } catch(e:any){ setMsg(errMsg(e)); } };
  const saveSection = async () => { try { const payload = {...sectionForm, capacity: sectionForm.capacity===""?null:Number(sectionForm.capacity), teacher_id: sectionForm.teacher_id||null, academic_session_id: sectionForm.academic_session_id||null}; editingSection ? await api.patch(`/sections/${editingSection.id}`, payload) : await api.post("/sections", payload); setSectionOpen(false); load(); } catch(e:any){ setMsg(errMsg(e)); } };
  const del = async (url:string) => { if(!confirm("Delete this record?")) return; try { await api.delete(url); load(); } catch(e:any){ setMsg(errMsg(e)); } };
  return <Page title="Classes & Sections" subtitle="Manage classes, sections, capacity, class teachers, and student enrollment records." action={<div className="flex gap-2"><Btn tone="ghost" onClick={()=>{setEditingClass(null); setClassForm({name:"",code:"",academic_session_id:"",level_order:"",description:"",status:"active"}); setClassOpen(true);}}>Add Class</Btn><Btn onClick={()=>{setEditingSection(null); setSectionForm({school_class_id:"",academic_session_id:"",name:"",code:"",capacity:"",teacher_id:"",room_number:"",status:"active"}); setSectionOpen(true);}}>Add Section</Btn></div>}>
    {msg && <div className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{msg}</div>}
    <div className="grid gap-3 sm:grid-cols-4"><Stat label="Total Classes" value={classes.length} /><Stat label="Active Classes" value={classes.filter(c=>c.status==="active").length} /><Stat label="Total Sections" value={classes.reduce((a,c)=>a+(c.sections?.length||0),0)} /><Stat label="Total Enrolled Students" value={enrollments.length} /></div>
    <Card title="Filters"><div className="grid gap-3 md:grid-cols-3"><Field label="Academic Session"><Select value={filter.academic_session_id} onChange={e=>setFilter({...filter,academic_session_id:e.target.value})}><option value="">All</option>{sessions.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</Select></Field><Field label="Class"><Select value={filter.school_class_id} onChange={e=>setFilter({...filter,school_class_id:e.target.value})}><option value="">All</option>{classes.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field><div className="flex items-end"><Btn tone="ghost" onClick={()=>setFilter({academic_session_id:"",school_class_id:""})}>Reset</Btn></div></div></Card>
    <Card title="Classes"><Table cols={["Name","Code","Session","Sections","Capacity","Status","Actions"]} rows={classes.map(c=>[c.name,c.code||"-",c.academic_session?.name||"-",String(c.sections?.length||0),String(c.sections?.reduce((a:any,s:any)=>a+(s.capacity||0),0)||0),c.status||"active",<div className="flex flex-wrap gap-2"><Btn tone="ghost" onClick={()=>{setEditingClass(c); setClassForm({name:c.name||"",code:c.code||"",academic_session_id:c.academic_session_id||"",level_order:c.level_order??"",description:c.description||"",status:c.status||"active"}); setClassOpen(true);}}>Edit</Btn><Btn tone="danger" onClick={()=>del(`/classes/${c.id}`)}>Delete</Btn></div>])} /></Card>
    <Card title="Sections"><Table cols={["Section","Class","Session","Teacher","Room","Capacity","Status","Actions"]} rows={classes.flatMap((c:any)=>(c.sections||[]).map((s:any)=>[s.name,c.name,c.academic_session?.name||sessions.find(x=>x.id===s.academic_session_id)?.name||"-",s.class_teacher?.user?.name||"-",s.room_number||"-",s.capacity??"-",s.status||"active",<div className="flex flex-wrap gap-2"><Btn tone="ghost" onClick={()=>{setEditingSection(s); setSectionForm({school_class_id:s.school_class_id,academic_session_id:s.academic_session_id||"",name:s.name||"",code:s.code||"",capacity:s.capacity??"",teacher_id:s.teacher_id||"",room_number:s.room_number||"",status:s.status||"active"}); setSectionOpen(true);}}>Edit</Btn><Btn tone="danger" onClick={()=>del(`/sections/${s.id}`)}>Delete</Btn></div>]))} /></Card>
    <Card title="Enrollments / Promotion Records"><Table cols={["Student","Admission No","Session","Class","Section","Roll","Status"]} rows={enrollments.map((e:any)=>[`${e.student?.first_name||""} ${e.student?.last_name||""}`.trim()||"-",e.student?.admission_number||"-",e.academic_session?.name||"-",e.school_class?.name||"-",e.section?.name||"-",e.roll_number||"-",e.status||"-"])} /></Card>
    <Modal open={classOpen} title={editingClass?"Edit Class":"Add Class"} onClose={()=>setClassOpen(false)}><div className="grid gap-3 md:grid-cols-2">
      <Field label="Class Name"><Input value={classForm.name} onChange={e=>setClassForm({...classForm,name:e.target.value})} /></Field>
      <Field label="Code"><Input value={classForm.code} onChange={e=>setClassForm({...classForm,code:e.target.value})} /></Field>
      <Field label="Academic Session"><Select value={classForm.academic_session_id} onChange={e=>setClassForm({...classForm,academic_session_id:e.target.value})}><option value="">Select</option>{sessions.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</Select></Field>
      <Field label="Level Order"><Input type="number" value={classForm.level_order} onChange={e=>setClassForm({...classForm,level_order:e.target.value})} /></Field>
      <Field label="Status"><Select value={classForm.status} onChange={e=>setClassForm({...classForm,status:e.target.value})}><option value="active">Active</option><option value="inactive">Inactive</option></Select></Field>
      <div className="md:col-span-2"><Field label="Description"><Textarea rows={3} value={classForm.description} onChange={e=>setClassForm({...classForm,description:e.target.value})} /></Field></div>
    </div><div className="mt-4 flex justify-end gap-2"><Btn tone="ghost" onClick={()=>setClassOpen(false)}>Cancel</Btn><Btn onClick={saveClass}>Save</Btn></div></Modal>
    <Modal open={sectionOpen} title={editingSection?"Edit Section":"Add Section"} onClose={()=>setSectionOpen(false)}><div className="grid gap-3 md:grid-cols-2">
      <Field label="Class"><Select value={sectionForm.school_class_id} onChange={e=>setSectionForm({...sectionForm,school_class_id:e.target.value})}><option value="">Select</option>{classes.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field>
      <Field label="Academic Session"><Select value={sectionForm.academic_session_id} onChange={e=>setSectionForm({...sectionForm,academic_session_id:e.target.value})}><option value="">Select</option>{sessions.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</Select></Field>
      <Field label="Section Name"><Input value={sectionForm.name} onChange={e=>setSectionForm({...sectionForm,name:e.target.value})} /></Field>
      <Field label="Code"><Input value={sectionForm.code} onChange={e=>setSectionForm({...sectionForm,code:e.target.value})} /></Field>
      <Field label="Capacity"><Input type="number" value={sectionForm.capacity} onChange={e=>setSectionForm({...sectionForm,capacity:e.target.value})} /></Field>
      <Field label="Class Teacher"><Select value={sectionForm.teacher_id} onChange={e=>setSectionForm({...sectionForm,teacher_id:e.target.value})}><option value="">Select</option>{teachers.map(t=><option key={t.id} value={t.id}>{t.user?.name || `${t.first_name||""} ${t.last_name||""}`.trim() || `Teacher #${t.id}`}</option>)}</Select></Field>
      <Field label="Room"><Input value={sectionForm.room_number} onChange={e=>setSectionForm({...sectionForm,room_number:e.target.value})} /></Field>
      <Field label="Status"><Select value={sectionForm.status} onChange={e=>setSectionForm({...sectionForm,status:e.target.value})}><option value="active">Active</option><option value="inactive">Inactive</option></Select></Field>
    </div><div className="mt-4 flex justify-end gap-2"><Btn tone="ghost" onClick={()=>setSectionOpen(false)}>Cancel</Btn><Btn onClick={saveSection}>Save</Btn></div></Modal>
  </Page>;
}

export function SubjectsPage() {
  const [subjects, setSubjects] = useState<AnyRow[]>([]);
  const [classes, setClasses] = useState<AnyRow[]>([]);
  const [sessions, setSessions] = useState<AnyRow[]>([]);
  const [teachers, setTeachers] = useState<AnyRow[]>([]);
  const [assignments, setAssignments] = useState<AnyRow[]>([]);
  const [msg, setMsg] = useState(""); const [open,setOpen]=useState(false); const [assignOpen,setAssignOpen]=useState(false);
  const [editing,setEditing]=useState<AnyRow|null>(null);
  const [form,setForm]=useState<any>({name:"",code:"",description:"",category:"",subject_type:"compulsory",credit_hours:"",full_marks:100,pass_marks:40,practical_full_marks:0,practical_pass_marks:0,status:"active"});
  const [assign,setAssign]=useState<any>({school_class_id:"",subject_id:"",academic_session_id:"",teacher_id:"",full_marks:100,pass_marks:40,practical_full_marks:0,practical_pass_marks:0});
  const load = async () => { try { const [s,c,se,t,a]=await Promise.all([api.get("/subjects"),api.get("/classes"),api.get("/academic-sessions"),api.get("/teachers?per_page=100"),api.get("/class-subjects")]); setSubjects(asRows(s.data)); setClasses(asRows(c.data)); setSessions(asRows(se.data)); setTeachers(asRows(t.data)); setAssignments(asRows(a.data)); } catch(e:any){ setMsg(errMsg(e)); } };
  useEffect(()=>{load();},[]);
  const save = async ()=>{ try { const payload={...form, credit_hours:form.credit_hours===""?null:Number(form.credit_hours)}; editing?await api.patch(`/subjects/${editing.id}`,payload):await api.post("/subjects",payload); setOpen(false); load(); } catch(e:any){ setMsg(errMsg(e)); } };
  const saveAssign = async ()=>{ try { await api.post("/class-subjects",{...assign, teacher_id:assign.teacher_id||null, academic_session_id:assign.academic_session_id||null}); setAssignOpen(false); load(); } catch(e:any){ setMsg(errMsg(e)); } };
  const del = async (url:string)=>{ if(!confirm("Delete?")) return; try{await api.delete(url); load();}catch(e:any){setMsg(errMsg(e));}};
  return <Page title="Subjects" subtitle="Create subjects and assign them to classes, sessions, and teachers." action={<div className="flex gap-2"><Btn tone="ghost" onClick={()=>{setAssign({school_class_id:"",subject_id:"",academic_session_id:"",teacher_id:"",full_marks:100,pass_marks:40,practical_full_marks:0,practical_pass_marks:0}); setAssignOpen(true);}}>Assign to Class</Btn><Btn onClick={()=>{setEditing(null); setForm({name:"",code:"",description:"",category:"",subject_type:"compulsory",credit_hours:"",full_marks:100,pass_marks:40,practical_full_marks:0,practical_pass_marks:0,status:"active"}); setOpen(true);}}>Add Subject</Btn></div>}>
    {msg && <div className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{msg}</div>}
    <Card title="Subject List"><Table cols={["Name","Code","Type","Category","Credit Hrs","Full/Pass","Practical","Status","Actions"]} rows={subjects.map(s=>[s.name,s.code,s.subject_type||"-",s.category||"-",s.credit_hours??"-",`${s.full_marks}/${s.pass_marks}`,`${s.practical_full_marks||0}/${s.practical_pass_marks||0}`,s.status||"active",<div className="flex gap-2"><Btn tone="ghost" onClick={()=>{setEditing(s); setForm({...s, credit_hours:s.credit_hours??"", description:s.description??"", category:s.category??"", status:s.status||"active"}); setOpen(true);}}>Edit</Btn><Btn tone="danger" onClick={()=>del(`/subjects/${s.id}`)}>Delete</Btn></div>])} /></Card>
    <Card title="Class Subject Assignments"><Table cols={["Class","Subject","Session","Teacher","Marks","Actions"]} rows={assignments.map(a=>[a.school_class?.name||a.school_class_id,a.subject?.name||a.subject_id,a.academic_session?.name||a.academic_session_id||"-",a.teacher?.user?.name||"-",`${a.full_marks}/${a.pass_marks}`,<Btn tone="danger" onClick={()=>del(`/class-subjects/${a.id}`)}>Remove</Btn>])} /></Card>
    <Modal open={open} title={editing?"Edit Subject":"Add Subject"} onClose={()=>setOpen(false)}><div className="grid gap-3 md:grid-cols-2">
      <Field label="Subject Name"><Input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} /></Field>
      <Field label="Code"><Input value={form.code} onChange={e=>setForm({...form,code:e.target.value})} /></Field>
      <Field label="Type"><Select value={form.subject_type} onChange={e=>setForm({...form,subject_type:e.target.value})}><option value="compulsory">Compulsory</option><option value="optional">Optional</option><option value="theory">Theory</option><option value="practical">Practical</option><option value="both">Both</option></Select></Field>
      <Field label="Category"><Input value={form.category} onChange={e=>setForm({...form,category:e.target.value})} /></Field>
      <Field label="Credit Hours"><Input type="number" value={form.credit_hours} onChange={e=>setForm({...form,credit_hours:e.target.value})} /></Field>
      <Field label="Status"><Select value={form.status} onChange={e=>setForm({...form,status:e.target.value})}><option value="active">Active</option><option value="inactive">Inactive</option></Select></Field>
      <Field label="Full Marks"><Input type="number" value={form.full_marks} onChange={e=>setForm({...form,full_marks:Number(e.target.value)})} /></Field>
      <Field label="Pass Marks"><Input type="number" value={form.pass_marks} onChange={e=>setForm({...form,pass_marks:Number(e.target.value)})} /></Field>
      <Field label="Practical Full"><Input type="number" value={form.practical_full_marks} onChange={e=>setForm({...form,practical_full_marks:Number(e.target.value)})} /></Field>
      <Field label="Practical Pass"><Input type="number" value={form.practical_pass_marks} onChange={e=>setForm({...form,practical_pass_marks:Number(e.target.value)})} /></Field>
      <div className="md:col-span-2"><Field label="Description"><Textarea rows={3} value={form.description} onChange={e=>setForm({...form,description:e.target.value})} /></Field></div>
    </div><div className="mt-4 flex justify-end gap-2"><Btn tone="ghost" onClick={()=>setOpen(false)}>Cancel</Btn><Btn onClick={save}>Save</Btn></div></Modal>
    <Modal open={assignOpen} title="Assign Subject to Class" onClose={()=>setAssignOpen(false)}><div className="grid gap-3 md:grid-cols-2">
      <Field label="Class"><Select value={assign.school_class_id} onChange={e=>setAssign({...assign,school_class_id:e.target.value})}><option value="">Select</option>{classes.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field>
      <Field label="Subject"><Select value={assign.subject_id} onChange={e=>setAssign({...assign,subject_id:e.target.value})}><option value="">Select</option>{subjects.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</Select></Field>
      <Field label="Session"><Select value={assign.academic_session_id} onChange={e=>setAssign({...assign,academic_session_id:e.target.value})}><option value="">Select</option>{sessions.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</Select></Field>
      <Field label="Teacher"><Select value={assign.teacher_id} onChange={e=>setAssign({...assign,teacher_id:e.target.value})}><option value="">Select</option>{teachers.map(t=><option key={t.id} value={t.id}>{t.user?.name || `Teacher #${t.id}`}</option>)}</Select></Field>
      <Field label="Full Marks"><Input type="number" value={assign.full_marks} onChange={e=>setAssign({...assign,full_marks:Number(e.target.value)})} /></Field>
      <Field label="Pass Marks"><Input type="number" value={assign.pass_marks} onChange={e=>setAssign({...assign,pass_marks:Number(e.target.value)})} /></Field>
    </div><div className="mt-4 flex justify-end gap-2"><Btn tone="ghost" onClick={()=>setAssignOpen(false)}>Cancel</Btn><Btn onClick={saveAssign}>Assign</Btn></div></Modal>
  </Page>;
}

export function TimetablePage() {
  const [classes,setClasses]=useState<AnyRow[]>([]); const [sections,setSections]=useState<AnyRow[]>([]); const [sessions,setSessions]=useState<AnyRow[]>([]);
  const [subjects,setSubjects]=useState<AnyRow[]>([]); const [teachers,setTeachers]=useState<AnyRow[]>([]);
  const [periods,setPeriods]=useState<AnyRow[]>([]); const [entries,setEntries]=useState<AnyRow[]>([]); const [msg,setMsg]=useState("");
  const [pOpen,setPOpen]=useState(false); const [eOpen,setEOpen]=useState(false); const [editingP,setEditingP]=useState<AnyRow|null>(null); const [editingE,setEditingE]=useState<AnyRow|null>(null);
  const [filter,setFilter]=useState({school_class_id:"",section_id:"",academic_session_id:""});
  const [pForm,setPForm]=useState<any>({name:"",label:"",starts_at:"08:00",ends_at:"08:45",sort_order:0,is_break:false});
  const [eForm,setEForm]=useState<any>({academic_session_id:"",school_class_id:"",section_id:"",day_of_week:"monday",timetable_period_id:"",subject_id:"",teacher_id:"",room_number:"",effective_from:"",effective_to:"",status:"active"});
  const load = async () => {
    try {
      const [c,se,s,sub,t,p,e] = await Promise.all([api.get("/classes"),api.get("/sections"),api.get("/academic-sessions"),api.get("/subjects"),api.get("/teachers?per_page=100"),api.get("/timetable-periods"),api.get("/timetable-entries",{params:filter})]);
      setClasses(asRows(c.data)); setSections(asRows(se.data)); setSessions(asRows(s.data)); setSubjects(asRows(sub.data)); setTeachers(asRows(t.data)); setPeriods(asRows(p.data)); setEntries(asRows(e.data));
    } catch(e:any){ setMsg(errMsg(e)); }
  };
  useEffect(()=>{load();},[filter.school_class_id,filter.section_id,filter.academic_session_id]);
  const saveP = async ()=>{ try { editingP?await api.patch(`/timetable-periods/${editingP.id}`,pForm):await api.post("/timetable-periods",pForm); setPOpen(false); load(); } catch(e:any){ setMsg(errMsg(e)); } };
  const saveE = async ()=>{ try { const payload={...eForm, subject_id:eForm.subject_id||null, teacher_id:eForm.teacher_id||null, effective_from:eForm.effective_from||null, effective_to:eForm.effective_to||null}; editingE?await api.patch(`/timetable-entries/${editingE.id}`,payload):await api.post("/timetable-entries",payload); setEOpen(false); load(); } catch(e:any){ setMsg(errMsg(e)); } };
  const del = async (url:string)=>{ if(!confirm("Delete?")) return; try{await api.delete(url); load();}catch(e:any){setMsg(errMsg(e));} };
  const days=["monday","tuesday","wednesday","thursday","friday","saturday","sunday"];
  const visibleSections = sections.filter((s:any)=>!filter.school_class_id || String(s.school_class_id)===String(filter.school_class_id));
  return <Page title="Timetable" subtitle="Define periods and assign class routines with teacher/room conflict validation." action={<div className="flex gap-2"><Btn tone="ghost" onClick={()=>{setEditingP(null); setPForm({name:"",label:"",starts_at:"08:00",ends_at:"08:45",sort_order:periods.length,is_break:false}); setPOpen(true);}}>Add Period</Btn><Btn onClick={()=>{setEditingE(null); setEForm({academic_session_id:filter.academic_session_id||"",school_class_id:filter.school_class_id||"",section_id:filter.section_id||"",day_of_week:"monday",timetable_period_id:"",subject_id:"",teacher_id:"",room_number:"",effective_from:"",effective_to:"",status:"active"}); setEOpen(true);}}>Add Entry</Btn></div>}>
    {msg && <div className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{msg}</div>}
    <Card title="Filters"><div className="grid gap-3 md:grid-cols-4"><Field label="Session"><Select value={filter.academic_session_id} onChange={e=>setFilter({...filter,academic_session_id:e.target.value})}><option value="">All</option>{sessions.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</Select></Field><Field label="Class"><Select value={filter.school_class_id} onChange={e=>setFilter({...filter,school_class_id:e.target.value,section_id:""})}><option value="">All</option>{classes.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field><Field label="Section"><Select value={filter.section_id} onChange={e=>setFilter({...filter,section_id:e.target.value})}><option value="">All</option>{visibleSections.map((s:any)=><option key={s.id} value={s.id}>{s.name}</option>)}</Select></Field><div className="flex items-end"><Btn tone="ghost" onClick={()=>setFilter({school_class_id:"",section_id:"",academic_session_id:""})}>Reset</Btn></div></div></Card>
    <Card title="Periods"><Table cols={["Order","Name","Label","Start","End","Break","Actions"]} rows={periods.map(p=>[p.sort_order,p.name,p.label||"-",p.starts_at,p.ends_at,p.is_break?"Yes":"No",<div className="flex gap-2"><Btn tone="ghost" onClick={()=>{setEditingP(p); setPForm({...p}); setPOpen(true);}}>Edit</Btn><Btn tone="danger" onClick={()=>del(`/timetable-periods/${p.id}`)}>Delete</Btn></div>])} /></Card>
    <Card title="Timetable Entries"><Table cols={["Day","Period","Class","Section","Subject","Teacher","Room","Status","Actions"]} rows={entries.map(e=>[e.day_of_week,e.period?.name||e.timetable_period_id,e.school_class?.name||e.school_class_id,e.section?.name||"-",e.subject?.name||"Break/Free",e.teacher?.user?.name||"-",e.room_number||"-",e.status||"active",<div className="flex gap-2"><Btn tone="ghost" onClick={()=>{setEditingE(e); setEForm({academic_session_id:e.academic_session_id||"",school_class_id:e.school_class_id||"",section_id:e.section_id||"",day_of_week:e.day_of_week||"monday",timetable_period_id:e.timetable_period_id||"",subject_id:e.subject_id||"",teacher_id:e.teacher_id||"",room_number:e.room_number||"",effective_from:e.effective_from?.slice(0,10)||"",effective_to:e.effective_to?.slice(0,10)||"",status:e.status||"active"}); setEOpen(true);}}>Edit</Btn><Btn tone="danger" onClick={()=>del(`/timetable-entries/${e.id}`)}>Delete</Btn></div>])} /></Card>
    <Modal open={pOpen} title={editingP?"Edit Period":"Add Period"} onClose={()=>setPOpen(false)}><div className="grid gap-3 md:grid-cols-2"><Field label="Name"><Input value={pForm.name} onChange={e=>setPForm({...pForm,name:e.target.value})} /></Field><Field label="Label"><Input value={pForm.label} onChange={e=>setPForm({...pForm,label:e.target.value})} /></Field><Field label="Start"><Input type="time" value={pForm.starts_at} onChange={e=>setPForm({...pForm,starts_at:e.target.value})} /></Field><Field label="End"><Input type="time" value={pForm.ends_at} onChange={e=>setPForm({...pForm,ends_at:e.target.value})} /></Field><Field label="Sort Order"><Input type="number" value={pForm.sort_order} onChange={e=>setPForm({...pForm,sort_order:Number(e.target.value)})} /></Field><label className="flex items-center gap-2 pt-7 text-sm"><input type="checkbox" checked={!!pForm.is_break} onChange={e=>setPForm({...pForm,is_break:e.target.checked})} /> Break period</label></div><div className="mt-4 flex justify-end gap-2"><Btn tone="ghost" onClick={()=>setPOpen(false)}>Cancel</Btn><Btn onClick={saveP}>Save</Btn></div></Modal>
    <Modal open={eOpen} title={editingE?"Edit Timetable Entry":"Add Timetable Entry"} onClose={()=>setEOpen(false)}><div className="grid gap-3 md:grid-cols-2">
      <Field label="Session"><Select value={eForm.academic_session_id} onChange={e=>setEForm({...eForm,academic_session_id:e.target.value})}><option value="">Select</option>{sessions.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</Select></Field>
      <Field label="Class"><Select value={eForm.school_class_id} onChange={e=>setEForm({...eForm,school_class_id:e.target.value,section_id:""})}><option value="">Select</option>{classes.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field>
      <Field label="Section"><Select value={eForm.section_id} onChange={e=>setEForm({...eForm,section_id:e.target.value})}><option value="">Select</option>{sections.filter((s:any)=>String(s.school_class_id)===String(eForm.school_class_id)).map((s:any)=><option key={s.id} value={s.id}>{s.name}</option>)}</Select></Field>
      <Field label="Day"><Select value={eForm.day_of_week} onChange={e=>setEForm({...eForm,day_of_week:e.target.value})}>{days.map(d=><option key={d} value={d}>{d}</option>)}</Select></Field>
      <Field label="Period"><Select value={eForm.timetable_period_id} onChange={e=>setEForm({...eForm,timetable_period_id:e.target.value})}><option value="">Select</option>{periods.map(p=><option key={p.id} value={p.id}>{p.name} ({p.starts_at}-{p.ends_at})</option>)}</Select></Field>
      <Field label="Subject"><Select value={eForm.subject_id} onChange={e=>setEForm({...eForm,subject_id:e.target.value})}><option value="">None/Break</option>{subjects.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</Select></Field>
      <Field label="Teacher"><Select value={eForm.teacher_id} onChange={e=>setEForm({...eForm,teacher_id:e.target.value})}><option value="">Select</option>{teachers.map(t=><option key={t.id} value={t.id}>{t.user?.name || `Teacher #${t.id}`}</option>)}</Select></Field>
      <Field label="Room"><Input value={eForm.room_number} onChange={e=>setEForm({...eForm,room_number:e.target.value})} /></Field>
      <Field label="Effective From"><Input type="date" value={eForm.effective_from} onChange={e=>setEForm({...eForm,effective_from:e.target.value})} /></Field>
      <Field label="Effective To"><Input type="date" value={eForm.effective_to} onChange={e=>setEForm({...eForm,effective_to:e.target.value})} /></Field>
    </div><div className="mt-4 flex justify-end gap-2"><Btn tone="ghost" onClick={()=>setEOpen(false)}>Cancel</Btn><Btn onClick={saveE}>Save</Btn></div></Modal>
  </Page>;
}

export function ExaminationsPage() {
  const [exams,setExams]=useState<AnyRow[]>([]); const [classes,setClasses]=useState<AnyRow[]>([]); const [sessions,setSessions]=useState<AnyRow[]>([]); const [subjects,setSubjects]=useState<AnyRow[]>([]);
  const [examSubjects,setExamSubjects]=useState<AnyRow[]>([]); const [selectedExam,setSelectedExam]=useState<number| "">("");
  const [msg,setMsg]=useState(""); const [open,setOpen]=useState(false); const [schedOpen,setSchedOpen]=useState(false);
  const [editing,setEditing]=useState<AnyRow|null>(null);
  const [form,setForm]=useState<any>({name:"",code:"",exam_type:"terminal",school_class_id:"",academic_session_id:"",description:"",starts_on:"",ends_on:"",result_publication_on:"",status:"draft"});
  const [sched,setSched]=useState<any>({subject_id:"",exam_date:"",starts_at:"",ends_at:"",full_marks:100,pass_marks:40,practical_full_marks:0,practical_pass_marks:0,room_number:""});
  const load = async () => { try { const [e,c,s,sub]=await Promise.all([api.get("/examinations"),api.get("/classes"),api.get("/academic-sessions"),api.get("/subjects")]); setExams(asRows(e.data)); setClasses(asRows(c.data)); setSessions(asRows(s.data)); setSubjects(asRows(sub.data)); } catch(e:any){ setMsg(errMsg(e)); } };
  const loadSched = async (id:number|string)=>{ if(!id){setExamSubjects([]); return;} try { const r=await api.get(`/examinations/${id}/subjects`); setExamSubjects(asRows(r.data));} catch(e:any){setMsg(errMsg(e));}};
  useEffect(()=>{load();},[]); useEffect(()=>{loadSched(selectedExam);},[selectedExam]);
  const save = async ()=>{ try { const payload={...form, academic_session_id:form.academic_session_id||null}; editing?await api.patch(`/examinations/${editing.id}`,payload):await api.post("/examinations",payload); setOpen(false); load(); } catch(e:any){ setMsg(errMsg(e)); } };
  const saveSched = async ()=>{ if(!selectedExam) return; try { await api.post(`/examinations/${selectedExam}/subjects`, {...sched, exam_date:sched.exam_date||null, starts_at:sched.starts_at||null, ends_at:sched.ends_at||null}); setSchedOpen(false); loadSched(selectedExam); } catch(e:any){ setMsg(errMsg(e)); } };
  const act = async (fn:()=>Promise<any>)=>{ try{await fn(); load(); if(selectedExam) loadSched(selectedExam);}catch(e:any){setMsg(errMsg(e));}};
  return <Page title="Examinations" subtitle="Create exams, schedule subject papers, and manage exam workflow." action={<Btn onClick={()=>{setEditing(null); setForm({name:"",code:"",exam_type:"terminal",school_class_id:"",academic_session_id:"",description:"",starts_on:"",ends_on:"",result_publication_on:"",status:"draft"}); setOpen(true);}}>Add Examination</Btn>}>
    {msg && <div className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{msg}</div>}
    <Card title="Exam List"><Table cols={["Name","Type","Class","Session","Dates","Status","Actions"]} rows={exams.map(e=>[e.name,e.exam_type,e.school_class?.name||e.school_class_id,e.academic_session?.name||"-",`${e.starts_on?.slice(0,10)||"-"} to ${e.ends_on?.slice(0,10)||"-"}`,e.status||"draft",<div className="flex flex-wrap gap-2"><Btn tone="ghost" onClick={()=>{setEditing(e); setForm({name:e.name||"",code:e.code||"",exam_type:e.exam_type||"terminal",school_class_id:e.school_class_id||"",academic_session_id:e.academic_session_id||"",description:e.description||"",starts_on:e.starts_on?.slice(0,10)||"",ends_on:e.ends_on?.slice(0,10)||"",result_publication_on:e.result_publication_on?.slice(0,10)||"",status:e.status||"draft"}); setOpen(true);}}>Edit</Btn><Btn tone="ghost" onClick={()=>{setSelectedExam(e.id);}}>Schedule</Btn><Btn tone="ghost" onClick={()=>act(()=>api.post(`/examinations/${e.id}/workflow`,{action:"submit"}))}>Submit</Btn><Btn tone="ghost" onClick={()=>act(()=>api.post(`/examinations/${e.id}/publish`))}>Publish</Btn><Btn tone="danger" onClick={()=>act(async()=>{if(confirm("Delete exam?")) await api.delete(`/examinations/${e.id}`);})}>Delete</Btn></div>])} /></Card>
    <Card title="Exam Subject Schedule" action={<div className="flex gap-2"><Select value={selectedExam} onChange={e=>setSelectedExam(e.target.value?Number(e.target.value):"")}><option value="">Select exam</option>{exams.map(e=><option key={e.id} value={e.id}>{e.name}</option>)}</Select>{selectedExam && <Btn onClick={()=>{setSched({subject_id:"",exam_date:"",starts_at:"",ends_at:"",full_marks:100,pass_marks:40,practical_full_marks:0,practical_pass_marks:0,room_number:""}); setSchedOpen(true);}}>Add Subject</Btn>}</div>}>
      <Table cols={["Subject","Date","Time","Marks","Room","Actions"]} rows={examSubjects.map(s=>[s.subject?.name||s.subject_id,s.exam_date?.slice(0,10)||"-",`${s.starts_at||"-"} - ${s.ends_at||"-"}`,`${s.full_marks}/${s.pass_marks}`+(s.practical_full_marks?` + P ${s.practical_full_marks}/${s.practical_pass_marks}`:""),s.room_number||"-",<Btn tone="danger" onClick={()=>act(()=>api.delete(`/examination-subjects/${s.id}`))}>Remove</Btn>])} />
    </Card>
    <Modal open={open} title={editing?"Edit Examination":"Add Examination"} onClose={()=>setOpen(false)}><div className="grid gap-3 md:grid-cols-2">
      <Field label="Exam Name"><Input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} /></Field>
      <Field label="Code"><Input value={form.code} onChange={e=>setForm({...form,code:e.target.value})} /></Field>
      <Field label="Type"><Select value={form.exam_type} onChange={e=>setForm({...form,exam_type:e.target.value})}><option value="terminal">Terminal</option><option value="midterm">Midterm</option><option value="final">Final</option><option value="practical">Practical</option><option value="unit_test">Unit Test</option><option value="board">Board</option></Select></Field>
      <Field label="Class"><Select value={form.school_class_id} onChange={e=>setForm({...form,school_class_id:e.target.value})}><option value="">Select</option>{classes.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field>
      <Field label="Session"><Select value={form.academic_session_id} onChange={e=>setForm({...form,academic_session_id:e.target.value})}><option value="">Select</option>{sessions.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</Select></Field>
      <Field label="Status"><Select value={form.status} onChange={e=>setForm({...form,status:e.target.value})}><option value="draft">Draft</option><option value="scheduled">Scheduled</option><option value="published">Published</option><option value="archived">Archived</option></Select></Field>
      <Field label="Start Date"><Input type="date" value={form.starts_on} onChange={e=>setForm({...form,starts_on:e.target.value})} /></Field><Field label="End Date"><Input type="date" value={form.ends_on} onChange={e=>setForm({...form,ends_on:e.target.value})} /></Field>
      <Field label="Result Publication"><Input type="date" value={form.result_publication_on} onChange={e=>setForm({...form,result_publication_on:e.target.value})} /></Field>
      <div className="md:col-span-2"><Field label="Description"><Textarea rows={3} value={form.description} onChange={e=>setForm({...form,description:e.target.value})} /></Field></div>
    </div><div className="mt-4 flex justify-end gap-2"><Btn tone="ghost" onClick={()=>setOpen(false)}>Cancel</Btn><Btn onClick={save}>Save</Btn></div></Modal>
    <Modal open={schedOpen} title="Add Exam Subject Schedule" onClose={()=>setSchedOpen(false)}><div className="grid gap-3 md:grid-cols-2">
      <Field label="Subject"><Select value={sched.subject_id} onChange={e=>setSched({...sched,subject_id:e.target.value})}><option value="">Select</option>{subjects.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</Select></Field>
      <Field label="Exam Date"><Input type="date" value={sched.exam_date} onChange={e=>setSched({...sched,exam_date:e.target.value})} /></Field>
      <Field label="Start Time"><Input type="time" value={sched.starts_at} onChange={e=>setSched({...sched,starts_at:e.target.value})} /></Field>
      <Field label="End Time"><Input type="time" value={sched.ends_at} onChange={e=>setSched({...sched,ends_at:e.target.value})} /></Field>
      <Field label="Full Marks"><Input type="number" value={sched.full_marks} onChange={e=>setSched({...sched,full_marks:Number(e.target.value)})} /></Field>
      <Field label="Pass Marks"><Input type="number" value={sched.pass_marks} onChange={e=>setSched({...sched,pass_marks:Number(e.target.value)})} /></Field>
      <Field label="Practical Full"><Input type="number" value={sched.practical_full_marks} onChange={e=>setSched({...sched,practical_full_marks:Number(e.target.value)})} /></Field>
      <Field label="Practical Pass"><Input type="number" value={sched.practical_pass_marks} onChange={e=>setSched({...sched,practical_pass_marks:Number(e.target.value)})} /></Field>
      <Field label="Room"><Input value={sched.room_number} onChange={e=>setSched({...sched,room_number:e.target.value})} /></Field>
    </div><div className="mt-4 flex justify-end gap-2"><Btn tone="ghost" onClick={()=>setSchedOpen(false)}>Cancel</Btn><Btn onClick={saveSched}>Add</Btn></div></Modal>
  </Page>;
}

export function MarksResultsPage() {
  const [exams,setExams]=useState<AnyRow[]>([]); const [classes,setClasses]=useState<AnyRow[]>([]); const [sections,setSections]=useState<AnyRow[]>([]); const [subjects,setSubjects]=useState<AnyRow[]>([]);
  const [students,setStudents]=useState<AnyRow[]>([]); const [results,setResults]=useState<AnyRow[]>([]); const [scales,setScales]=useState<AnyRow[]>([]);
  const [msg,setMsg]=useState("");
  const [sel,setSel]=useState({school_class_id:"",section_id:"",examination_id:"",subject_id:""});
  const [rows,setRows]=useState<AnyRow[]>([]);
  const [scaleForm,setScaleForm]=useState<any>({name:"",is_default:false,items:[{grade:"A+",min_marks:80,max_marks:100,gpa:4,remarks:"Excellent"},{grade:"A",min_marks:70,max_marks:79,gpa:3.6,remarks:"Very Good"},{grade:"B",min_marks:60,max_marks:69,gpa:3.2,remarks:"Good"},{grade:"C",min_marks:50,max_marks:59,gpa:2.8,remarks:"Satisfactory"},{grade:"D",min_marks:40,max_marks:49,gpa:2.4,remarks:"Pass"},{grade:"F",min_marks:0,max_marks:39,gpa:0,remarks:"Fail"}]});
  const [scaleOpen,setScaleOpen]=useState(false);
  const loadBase = async ()=>{ try { const [e,c,sec,sub,sc]=await Promise.all([api.get("/examinations"),api.get("/classes"),api.get("/sections"),api.get("/subjects"),api.get("/grading-scales")]); setExams(asRows(e.data)); setClasses(asRows(c.data)); setSections(asRows(sec.data)); setSubjects(asRows(sub.data)); setScales(asRows(sc.data));} catch(e:any){setMsg(errMsg(e));}};
  useEffect(()=>{loadBase();},[]);
  useEffect(()=>{ const loadStudents=async()=>{ if(!sel.school_class_id){setStudents([]); setRows([]); return;} try { const r=await api.get(`/classes/${sel.school_class_id}/students`); const list=asRows(r.data); const filtered = sel.section_id ? list.filter((s:any)=>String(s.section_id)===String(sel.section_id)) : list; setStudents(filtered); setRows(filtered.map((s:any)=>({student_id:s.id, theory_marks:"", practical_marks:"", remarks:""}))); } catch(e:any){setMsg(errMsg(e));}}; loadStudents(); },[sel.school_class_id,sel.section_id]);
  const loadResults = async ()=>{ if(!sel.examination_id) return; try { const r=await api.get(`/examinations/${sel.examination_id}/results`); setResults(asRows(r.data.data ?? r.data));} catch(e:any){setMsg(errMsg(e));}};
  useEffect(()=>{ if(sel.examination_id) loadResults(); },[sel.examination_id]);
  const saveMarks = async ()=>{ if(!sel.examination_id||!sel.subject_id) { setMsg("Select exam and subject."); return; } try { await api.post(`/examinations/${sel.examination_id}/marks`, { subject_id:Number(sel.subject_id), marks: rows.map(r=>({student_id:r.student_id, theory_marks:r.theory_marks===""?null:Number(r.theory_marks), practical_marks:r.practical_marks===""?null:Number(r.practical_marks), remarks:r.remarks||null})) }); setMsg("Marks saved as draft."); loadResults(); } catch(e:any){ setMsg(errMsg(e)); } };
  const workflow = async (action:string)=>{ if(!sel.examination_id) return; try { await api.post(`/examinations/${sel.examination_id}/workflow`,{action}); setMsg(`Marks ${action} successful.`); loadResults(); } catch(e:any){ setMsg(errMsg(e)); } };
  const saveScale = async ()=>{ try { await api.post("/grading-scales", scaleForm); setScaleOpen(false); loadBase(); } catch(e:any){ setMsg(errMsg(e)); } };
  const filteredSections = sections.filter((s:any)=>!sel.school_class_id || String(s.school_class_id)===String(sel.school_class_id));
  return <Page title="Marks & Results" subtitle="Enter marks, run draft/submit/approve/publish workflow, manage grading scales, and view results." action={<Btn tone="ghost" onClick={()=>setScaleOpen(true)}>Add Grading Scale</Btn>}>
    {msg && <div className="rounded-xl bg-sky-50 px-3 py-2 text-sm text-sky-800">{msg}</div>}
    <Card title="Selection"><div className="grid gap-3 md:grid-cols-4">
      <Field label="Class"><Select value={sel.school_class_id} onChange={e=>setSel({...sel,school_class_id:e.target.value,section_id:""})}><option value="">Select</option>{classes.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field>
      <Field label="Section"><Select value={sel.section_id} onChange={e=>setSel({...sel,section_id:e.target.value})}><option value="">All</option>{filteredSections.map((s:any)=><option key={s.id} value={s.id}>{s.name}</option>)}</Select></Field>
      <Field label="Exam"><Select value={sel.examination_id} onChange={e=>setSel({...sel,examination_id:e.target.value})}><option value="">Select</option>{exams.map(e=><option key={e.id} value={e.id}>{e.name}</option>)}</Select></Field>
      <Field label="Subject"><Select value={sel.subject_id} onChange={e=>setSel({...sel,subject_id:e.target.value})}><option value="">Select</option>{subjects.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</Select></Field>
    </div></Card>
    <Card title="Marks Entry" action={<div className="flex flex-wrap gap-2"><Btn onClick={saveMarks}>Save Draft</Btn><Btn tone="ghost" onClick={()=>workflow("submit")}>Submit</Btn><Btn tone="ghost" onClick={()=>workflow("approve")}>Approve</Btn><Btn tone="ghost" onClick={()=>workflow("publish")}>Publish</Btn><Btn tone="ghost" onClick={()=>workflow("lock")}>Lock</Btn></div>}>
      <Table cols={["Student","Roll","Theory","Practical","Remarks"]} rows={rows.map((r,i)=>{ const s=students.find((x:any)=>x.id===r.student_id); return [ `${s?.first_name||""} ${s?.last_name||""}`.trim()||`#${r.student_id}`, s?.roll_number||"-", <Input type="number" value={r.theory_marks} onChange={e=>{const n=[...rows]; n[i]={...n[i],theory_marks:e.target.value}; setRows(n);}} />, <Input type="number" value={r.practical_marks} onChange={e=>{const n=[...rows]; n[i]={...n[i],practical_marks:e.target.value}; setRows(n);}} />, <Input value={r.remarks} onChange={e=>{const n=[...rows]; n[i]={...n[i],remarks:e.target.value}; setRows(n);}} /> ]; })} />
    </Card>
    <Card title="Results / Report Preview"><Table cols={["Student","Admission No","Total","Obtained","%","GPA","Result","Rank"]} rows={results.map((r:any)=>[`${r.student?.first_name||""} ${r.student?.last_name||""}`.trim(), r.student?.admission_number||"-", r.total_full_marks, r.total_obtained, `${r.percentage}%`, r.gpa, r.final_result, r.rank])} /></Card>
    <Card title="Grading Scales"><Table cols={["Name","Default","Grades"]} rows={scales.map((s:any)=>[s.name,s.is_default?"Yes":"No",(s.items||[]).map((i:any)=>`${i.grade}:${i.min_marks}-${i.max_marks}`).join(", ")])} /></Card>
    <Modal open={scaleOpen} title="Add Grading Scale" onClose={()=>setScaleOpen(false)}>
      <div className="grid gap-3 md:grid-cols-2"><Field label="Scale Name"><Input value={scaleForm.name} onChange={e=>setScaleForm({...scaleForm,name:e.target.value})} /></Field><label className="flex items-center gap-2 pt-7 text-sm"><input type="checkbox" checked={scaleForm.is_default} onChange={e=>setScaleForm({...scaleForm,is_default:e.target.checked})} /> Default scale</label></div>
      <div className="mt-3 space-y-2">{scaleForm.items.map((it:any,idx:number)=><div key={idx} className="grid gap-2 md:grid-cols-6"><Input placeholder="Grade" value={it.grade} onChange={e=>{const items=[...scaleForm.items]; items[idx]={...it,grade:e.target.value}; setScaleForm({...scaleForm,items});}} /><Input type="number" placeholder="Min" value={it.min_marks} onChange={e=>{const items=[...scaleForm.items]; items[idx]={...it,min_marks:Number(e.target.value)}; setScaleForm({...scaleForm,items});}} /><Input type="number" placeholder="Max" value={it.max_marks} onChange={e=>{const items=[...scaleForm.items]; items[idx]={...it,max_marks:Number(e.target.value)}; setScaleForm({...scaleForm,items});}} /><Input type="number" placeholder="GPA" value={it.gpa} onChange={e=>{const items=[...scaleForm.items]; items[idx]={...it,gpa:Number(e.target.value)}; setScaleForm({...scaleForm,items});}} /><Input placeholder="Remarks" value={it.remarks} onChange={e=>{const items=[...scaleForm.items]; items[idx]={...it,remarks:e.target.value}; setScaleForm({...scaleForm,items});}} /><Btn tone="danger" onClick={()=>setScaleForm({...scaleForm,items:scaleForm.items.filter((_:any,i:number)=>i!==idx)})}>Remove</Btn></div>)}</div>
      <div className="mt-3 flex gap-2"><Btn tone="ghost" onClick={()=>setScaleForm({...scaleForm,items:[...scaleForm.items,{grade:"",min_marks:0,max_marks:0,gpa:0,remarks:""}]})}>Add Grade Row</Btn></div>
      <div className="mt-4 flex justify-end gap-2"><Btn tone="ghost" onClick={()=>setScaleOpen(false)}>Cancel</Btn><Btn onClick={saveScale}>Save Scale</Btn></div>
    </Modal>
  </Page>;
}
