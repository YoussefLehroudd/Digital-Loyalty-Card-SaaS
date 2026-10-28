import {ChartSpline,Compass,CreditCard,Handshake,Home,Settings,Trophy,Download,User,UserRoundPlus,MessageSquare,Cake} from "lucide-react";

// Shared labels and destinations for the desktop sidebar and the persistent
// mobile tab strip. Keep the same list across all customer pages.
export const customerNavItems=[
  {href:"/user/dashboard",label:"Home",icon:Home},
  {href:"/user/explore",label:"Explore",icon:Compass},
  {href:"/user/cards",label:"Cards",icon:CreditCard},
  {href:"/user/rewards",label:"Rewards",icon:Trophy},
  {href:"/user/activity",label:"Activity",icon:ChartSpline},
  {href:"/user/invite",label:"Invite friends",icon:UserRoundPlus},
  {href:"/user/feedback",label:"Feedback",icon:MessageSquare},
  {href:"/user/birthday",label:"Birthday rewards",icon:Cake},
  {href:"/user/profile",label:"Profile",icon:User},
  {href:"/user/settings",label:"Settings",icon:Settings},
  {href:"/user/install",label:"Install App",icon:Download},
];
export const customerAffiliateNavItem={href:"/user/affiliate",label:"Affiliate",icon:Handshake};
