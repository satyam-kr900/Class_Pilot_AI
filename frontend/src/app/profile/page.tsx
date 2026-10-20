"use client";
import { useEffect, useState } from "react";
import { useInstitute } from "@/lib/useInstitute";
import { supabase } from "@/lib/supabase";

type ProfileRole =
  | "owner"
  | "teacher"
  | "staff"
  | "parent"
  | "student";

interface StudentProfileData {
  pic_url: string | null;
  admission_no: string | null;
  course: string | null;
  roll_number: string | null;
  guardian_name: string | null;
  guardian_phone: string | null;
  class_name: string | null;
  full_address: string | null;
}

interface TeacherProfileData {
  pic_url: string | null;
  qualifications: string | null;
  subjects: string | null;
  classes: string | null;
  experience: string | null;
  residential_address: string | null;
}

interface ProfileData {
  role: ProfileRole | null;
  full_name: string | null;
  pic_url: string | null;
  full_address: string | null;
  institute_pic_url: string | null;
  institute_name: string | null;
  student: StudentProfileData | null;
  teacher: TeacherProfileData | null;
}

export default function ProfilePage() {
  const { role, instituteId, memberships, loading } = useInstitute();
  const [profile, setProfile] = useState<ProfileData>({
    role: null,
    full_name: null,
    pic_url: null,
    full_address: null,
    institute_pic_url: null,
    institute_name: null,
    student: null,
    teacher: null,
  });

  useEffect(() => {
    async function fetchProfile() {
      try {
        const { data: sessionData, error } = await supabase.auth.getSession();
        if (error || !sessionData?.session?.access_token) return;
        const token = sessionData.session.access_token;
        const res = await fetch("/api/v1/profiles/me", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error("Profile fetch failed");
        const profileData = await res.json();
        setProfile({
          role: profileData.role as ProfileRole || null,
          full_name: profileData.full_name || null,
          pic_url: profileData.pic_url || null,
          full_address: profileData.full_address || null,
          institute_pic_url: profileData.institute_pic_url || null,
          institute_name: profileData.institute_name || null,
          student: profileData.student
            ? {
                pic_url: profileData.pic_url,
                admission_no: profileData.admission_no,
                course: profileData.course,
                roll_number: profileData.roll_number,
                guardian_name: profileData.guardian_name,
                guardian_phone: profileData.guardian_phone,
                class_name: profileData.class_name,
                full_address: profileData.full_address,
              }
            : null,
          teacher: profileData.teacher
            ? {
                pic_url: profileData.pic_url,
                qualifications: profileData.qualifications,
                subjects: profileData.subjects,
                classes: profileData.classes,
                experience: profileData.experience,
                residential_address: profileData.residential_address,
              }
            : null,
        });
      } catch (e) {
        console.error("Profile fetch error:", e);
      }
    }
    fetchProfile();
  }, []);

  if (loading) return null;

  return (
    <div className="min-h-screen bg-[color:#eef2ff] text-slate-800 p-4 sm:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Profile Header */}
        <div className="text-center mb-8">
          {profile.institute_pic_url && (
            <img
              src={profile.institute_pic_url}
              alt={profile.institute_name || "Institute logo"}
              className="w-24 h-24 rounded-full mx-auto mb-4 object-cover border-2 border-white"
            />
          )}

          {profile.full_name && (
            <h1 className="text-3xl font-extrabold text-slate-800">{profile.full_name}</h1>
          )}

          <p className="text-sm text-slate-500 mt-1">
            Role: {profile.role || "N/A"}
          </p>
        </div>

        {/* Role-specific details grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8">
          {/* Profile Picture */}
          {profile.pic_url && (
            <div className="flex flex-col items-center">
              <img
                src={profile.pic_url}
                alt="Profile picture"
                className="w-28 h-28 rounded-full object-cover border-2 border-red-500 mb-2"
              />
              <p className="text-xs text-slate-500">Profile Picture</p>
            </div>
          )}

          {/* Teacher-specific fields */}
          {profile.teacher && (
            <div className="space-y-2 text-sm">
              <p className="font-medium text-slate-700">Qualifications:</p>
              <p className="break-all text-slate-700">{profile.teacher.qualifications || "N/A"}</p>
              <p className="font-medium text-slate-700">Subjects:</p>
              <p className="break-all text-slate-700">{profile.teacher.subjects || "N/A"}</p>
              <p className="font-medium text-slate-700">Classes:</p>
              <p className="break-all text-slate-700">{profile.teacher.classes || "N/A"}</p>
              <p className="font-medium text-slate-700">Experience:</p>
              <p className="break-all text-slate-700">{profile.teacher.experience || "N/A"}</p>
              <p className="font-medium text-slate-700">Residential Address:</p>
              <p className="break-all text-slate-700 truncate line-clamp-3">{profile.teacher.residential_address || "N/A"}</p>
            </div>
          )}

          {/* Student-specific fields */}
          {profile.student && (
            <div className="space-y-3 text-sm">
              <p className="font-medium text-slate-700">Admission:</p>
              <p className="font-medium text-slate-700 break-all">{profile.student.admission_no || "N/A"}</p>
              <p className="font-medium text-slate-700">Course:</p>
              <p className="font-medium text-slate-700 break-all">{profile.student.course || "N/A"}</p>
              <p className="font-medium text-slate-700">Roll No:</p>
              <p className="font-medium text-slate-700 break-all">{profile.student.roll_number || "N/A"}</p>
              <p className="font-medium text-slate-700">Guardian:</p>
              <p className="font-medium text-slate-700 break-all">{profile.student.guardian_name || "N/A"}</p>
              <p className="font-medium text-slate-700">Guardian Phone:</p>
              <p className="font-medium text-slate-700 break-all">{profile.student.guardian_phone || "N/A"}</p>
              <p className="font-medium text-slate-700">Class:</p>
              <p className="font-medium text-slate-700 break-all">{profile.student.class_name || "N/A"}</p>
              <p className="font-medium text-slate-700">Full Address:</p>
              <p className="font-medium text-slate-700 break-all truncate line-clamp-3">{profile.student.full_address || "N/A"}</p>
            </div>
          )}

          {/* Full Address (shared) */}
          {profile.full_address && (
            <div>
              <p className="text-sm text-slate-700">{profile.full_address}</p>
            </div>
          )}

          {/* Institute Picture (for owner/staff) */}
          {profile.institute_pic_url && profile.role === "owner" && (
            <div>
              <img
                src={profile.institute_pic_url}
                alt="Institute logo"
                className="w-20 h-20 rounded-full object-cover border-2 border-white"
              />
              <p className="mt-2 text-xs text-slate-500">Institute Logo</p>
            </div>
          )}

          {/* Student Picture (for student/parent) */}
          {profile.pic_url && (profile.role === "student" || profile.role === "parent") && (
            <div>
              <img
                src={profile.pic_url}
                alt="Student picture"
                className="w-32 h-32 rounded-full object-cover border-2 border-green-500"
              />
              <p className="mt-2 text-xs text-slate-500">Student Picture</p>
            </div>
          )}
        </div>

        {/* Back to dashboard button */}
        <div className="mt-8 text-center">
          <a
            href="/dashboard"
            className="inline-block rounded-2xl bg-red-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-red-600/30 transition hover:bg-red-500"
          >
            Back to Dashboard
          </a>
        </div>
      </div>
    </div>
  );
}