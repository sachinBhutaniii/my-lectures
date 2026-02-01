import MainBanner from "@/components/MainBanner";
import AdminVideoList from "@/components/AdminVideoList";

export default function AdminPage() {
  return (
    <>
      {/* <MainBanner /> */}
      <div className="mx-auto max-w-6xl p-6 sm:p-0 mt-10">
          <AdminVideoList />
      </div>
    </>
  );
}
