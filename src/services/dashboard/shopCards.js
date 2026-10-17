import Router from 'next/router';
import { shopRoute } from '../../utils/dashboardRoutes.js';
import { icons } from './elements.js';
import { summarizeBusinessProfile } from '../../utils/businessProfile.js';

// สร้างการ์ดร้านทีละใบ โดยใช้ textContent กับข้อมูลที่มาจาก API
function createShopCard(shop) {
  const card = document.createElement("button");

  card.type = "button";
  card.className = [
    "app-shop-card group rounded-3xl border bg-white p-5 text-left",
    "transition hover:-translate-y-1",
  ].join(" ");

  const top = document.createElement("div");
  top.className = "flex items-start justify-between gap-4";

  const icon = document.createElement("div");
  icon.className = [
    "flex size-12 items-center justify-center rounded-2xl",
    "bg-[#e1f8f4] text-2xl text-[#3855b8]",
  ].join(" ");
  icon.innerHTML = icons.store;

  const arrow = document.createElement("span");
  arrow.className = [
    "text-lg text-[#93a8d7] transition",
    "group-hover:translate-x-1 group-hover:text-[#3855b8]",
  ].join(" ");
  arrow.innerHTML = icons.arrow;

  top.append(icon, arrow);

  const name = document.createElement("h3");
  name.className = "mt-5 text-lg font-bold text-slate-900";
  name.textContent = shop.name;

  const description = document.createElement("p");
  description.className =
    "mt-2 line-clamp-2 min-h-10 text-sm leading-5 text-slate-500";
  description.textContent = summarizeBusinessProfile(shop.description);

  const footer = document.createElement("div");
  footer.className =
    "mt-5 flex items-center justify-between border-t border-slate-100 pt-4";

  const role = document.createElement("span");
  role.className =
    "rounded-full bg-[#eef3ff] px-3 py-1 text-xs font-semibold text-[#3855b8]";
  role.textContent = shop.member_role === "owner" ? "เจ้าของร้าน" : "เจ้าหน้าที่";

  const action = document.createElement("span");
  action.className = "text-xs font-semibold text-slate-400";
  action.textContent = "เปิดร้าน";

  footer.append(role, action);
  card.append(top, name, description, footer);

  card.addEventListener("click", () => {
    Router.push(shopRoute(shop.id), undefined, { shallow: true, scroll: false });
  });

  return card;
}

function renderShops(shops, elements) {
  elements.shopList.replaceChildren();
  elements.shopCount.textContent = String(shops.length);
  elements.shopLoading.classList.add("hidden");

  if (shops.length === 0) {
    elements.emptyShops.classList.remove("hidden");
    return;
  }

  elements.emptyShops.classList.add("hidden");

  for (const shop of shops) {
    elements.shopList.append(createShopCard(shop));
  }
}

export { renderShops };
