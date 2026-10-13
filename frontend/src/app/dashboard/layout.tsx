import Navbar from "@/components/Navbar";
import Sidebar from "@/components/Sidebar";
import InstituteSwitcher from "@/components/InstituteSwitcher";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="mx-auto flex max-w-6xl flex-col gap-4 overflow-x-clip px-4 py-4 lg:flex-row">
        <Sidebar />
        <div className="min-w-0 flex-1 space-y-4">
          <InstituteSwitcher />
          {children}
        </div>
      </div>
    </div>
  );
}
