export default function Home() {
  return null;
}

export async function getServerSideProps() {
  // หน้าแรกของผู้เยี่ยมชมอยู่ที่ /home ส่วน /app ยังรับหน้าที่เข้าสู่ระบบและแดชบอร์ด
  return { redirect: { destination: '/home', permanent: false } };
}
