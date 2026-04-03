import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { base44 } from "@/api/base44Client";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2 } from "lucide-react";

export default function Register() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    gender: "",
    birth_date: "",
    height_cm: "",
    current_weight: "",
    target_weight: "",
    activity_level: "",
    has_chronic_diseases: false,
    chronic_diseases_details: "",
    phone: "",
  });

  const updateForm = (key, value) => setForm(prev => ({ ...prev, [key]: value }));

  const calculateBMI = (weight, heightCm) => {
    const heightM = heightCm / 100;
    return +(weight / (heightM * heightM)).toFixed(1);
  };

  const calculateIdealWeight = (heightCm, gender) => {
    const heightM = heightCm / 100;
    const min = +(18.5 * heightM * heightM).toFixed(1);
    const max = +(24.9 * heightM * heightM).toFixed(1);
    return { min, max };
  };

  const calculateDailyCalories = (weight, heightCm, age, gender, activityLevel) => {
    let bmr;
    if (gender === "male") {
      bmr = 10 * weight + 6.25 * heightCm - 5 * age + 5;
    } else {
      bmr = 10 * weight + 6.25 * heightCm - 5 * age - 161;
    }
    const multipliers = { sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725 };
    const tdee = bmr * (multipliers[activityLevel] || 1.2);
    return Math.round(tdee - 500);
  };

  const handleSubmit = async () => {
    setLoading(true);
    const weight = parseFloat(form.current_weight);
    const height = parseFloat(form.height_cm);
    const birthYear = new Date(form.birth_date).getFullYear();
    const age = new Date().getFullYear() - birthYear;
    const bmi = calculateBMI(weight, height);
    const idealWeight = calculateIdealWeight(height, form.gender);
    const dailyCalories = calculateDailyCalories(weight, height, age, form.gender, form.activity_level);

    const subscriberData = {
      ...form,
      height_cm: height,
      current_weight: weight,
      target_weight: parseFloat(form.target_weight),
      bmi,
      ideal_weight_min: idealWeight.min,
      ideal_weight_max: idealWeight.max,
      daily_calorie_target: dailyCalories,
      subscription_status: "trial",
    };

    await base44.entities.Subscriber.create(subscriberData);
    
    // Save subscriber info on the user
    await base44.auth.updateMe({
      subscriber_registered: true,
      subscriber_name: form.full_name,
    });

    setLoading(false);
    navigate("/dashboard");
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">إنشاء حساب جديد</h1>
          <p className="text-muted-foreground">أدخل بياناتك لنبدأ رحلتك</p>
          <div className="flex justify-center gap-2 mt-4">
            {[1, 2, 3].map(s => (
              <div key={s} className={`h-1.5 rounded-full transition-all ${s === step ? 'w-8 bg-primary' : s < step ? 'w-8 bg-primary/40' : 'w-8 bg-border'}`} />
            ))}
          </div>
        </div>

        <div className="bg-card rounded-2xl border border-border/50 p-8 shadow-lg">
          {step === 1 && (
            <div className="space-y-5">
              <div>
                <Label>الاسم الكامل</Label>
                <Input value={form.full_name} onChange={e => updateForm("full_name", e.target.value)} placeholder="محمد أحمد" className="mt-1.5" />
              </div>
              <div>
                <Label>البريد الإلكتروني</Label>
                <Input type="email" value={form.email} onChange={e => updateForm("email", e.target.value)} placeholder="email@example.com" className="mt-1.5" dir="ltr" />
              </div>
              <div>
                <Label>رقم الجوال</Label>
                <Input value={form.phone} onChange={e => updateForm("phone", e.target.value)} placeholder="+966 5XX XXX XXXX" className="mt-1.5" dir="ltr" />
              </div>
              <div>
                <Label>الجنس</Label>
                <Select value={form.gender} onValueChange={v => updateForm("gender", v)}>
                  <SelectTrigger className="mt-1.5"><SelectValue placeholder="اختر الجنس" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">ذكر</SelectItem>
                    <SelectItem value="female">أنثى</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>تاريخ الميلاد</Label>
                <Input type="date" value={form.birth_date} onChange={e => updateForm("birth_date", e.target.value)} className="mt-1.5" dir="ltr" />
              </div>
              <Button onClick={() => setStep(2)} className="w-full bg-primary text-primary-foreground py-5 gap-2" disabled={!form.full_name || !form.email || !form.gender}>
                التالي <ArrowLeft className="w-4 h-4" />
              </Button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              <div>
                <Label>الطول (سم)</Label>
                <Input type="number" value={form.height_cm} onChange={e => updateForm("height_cm", e.target.value)} placeholder="170" className="mt-1.5" dir="ltr" />
              </div>
              <div>
                <Label>الوزن الحالي (كغ)</Label>
                <Input type="number" value={form.current_weight} onChange={e => updateForm("current_weight", e.target.value)} placeholder="85" className="mt-1.5" dir="ltr" />
              </div>
              <div>
                <Label>الوزن المستهدف (كغ)</Label>
                <Input type="number" value={form.target_weight} onChange={e => updateForm("target_weight", e.target.value)} placeholder="70" className="mt-1.5" dir="ltr" />
              </div>
              <div>
                <Label>مستوى النشاط</Label>
                <Select value={form.activity_level} onValueChange={v => updateForm("activity_level", v)}>
                  <SelectTrigger className="mt-1.5"><SelectValue placeholder="اختر مستوى النشاط" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sedentary">خامل (مكتبي)</SelectItem>
                    <SelectItem value="light">خفيف (تمرين 1-3 مرات/أسبوع)</SelectItem>
                    <SelectItem value="moderate">متوسط (تمرين 3-5 مرات/أسبوع)</SelectItem>
                    <SelectItem value="active">نشيط (تمرين 6-7 مرات/أسبوع)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep(1)} className="flex-1 py-5">السابق</Button>
                <Button onClick={() => setStep(3)} className="flex-1 bg-primary text-primary-foreground py-5 gap-2" disabled={!form.height_cm || !form.current_weight || !form.target_weight}>
                  التالي <ArrowLeft className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <Label>هل لديك أمراض مزمنة؟</Label>
                <Switch checked={form.has_chronic_diseases} onCheckedChange={v => updateForm("has_chronic_diseases", v)} />
              </div>
              {form.has_chronic_diseases && (
                <div>
                  <Label>تفاصيل الأمراض</Label>
                  <Textarea value={form.chronic_diseases_details} onChange={e => updateForm("chronic_diseases_details", e.target.value)} placeholder="اذكر الأمراض المزمنة..." className="mt-1.5" />
                </div>
              )}

              {form.height_cm && form.current_weight && (
                <div className="bg-secondary/50 rounded-xl p-5 space-y-3">
                  <h3 className="font-semibold text-foreground">ملخص بياناتك</h3>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-muted-foreground">مؤشر BMI</p>
                      <p className="font-bold text-foreground text-lg">{calculateBMI(parseFloat(form.current_weight), parseFloat(form.height_cm))}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">الوزن المثالي</p>
                      <p className="font-bold text-foreground text-lg">
                        {calculateIdealWeight(parseFloat(form.height_cm), form.gender).min} - {calculateIdealWeight(parseFloat(form.height_cm), form.gender).max} كغ
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">هدف الخسارة</p>
                      <p className="font-bold text-accent text-lg">{(parseFloat(form.current_weight) - parseFloat(form.target_weight)).toFixed(1)} كغ</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">المدة التقريبية</p>
                      <p className="font-bold text-foreground text-lg">{Math.ceil((parseFloat(form.current_weight) - parseFloat(form.target_weight)) / 0.75)} أسبوع</p>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep(2)} className="flex-1 py-5">السابق</Button>
                <Button onClick={handleSubmit} disabled={loading} className="flex-1 bg-accent hover:bg-accent/90 text-white py-5 gap-2">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>إنشاء الحساب <ArrowLeft className="w-4 h-4" /></>}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}