import jwt from "jsonwebtoken";
import User from "../models/User";

export function normalizeEmail(e) {
  return (e || "").toLowerCase().trim();
}

export function isGmail(e) {
  return /^[a-zA-Z0-9._%+-]+@gmail\.com$/.test(e);
}

const TEMP_EMAIL_DOMAINS = new Set([
  // Mailinator family
  "mailinator.com","mailinator2.com","mailinator.us","suremail.info","spamherelots.com",
  // Guerrilla Mail
  "guerrillamail.com","guerrillamail.net","guerrillamail.org","guerrillamail.biz","guerrillamail.de","guerrillamail.info","grr.la","spam4.me","sharklasers.com","guerrillamailblock.com",
  // YopMail
  "yopmail.com","yopmail.fr","cool.fr.nf","jetable.fr.nf","nospam.ze.tc","nomail.xl.cx","mega.zik.dj","speed.1s.fr","courriel.fr.nf","moncourrier.fr.nf","monemail.fr.nf","monmail.fr.nf",
  // TempMail
  "tempmail.com","tempmail.net","tempmail.org","temp-mail.org","temp-mail.io","temp-mail.ru","dispostable.com","tempr.email","discard.email","discardmail.com","discardmail.de","wegwerfmail.de","wegwerfmail.net","wegwerfmail.org",
  // Throwaway
  "throwam.com","throwam.net","throwaway.email","fakeinbox.com","maildrop.cc","spamgourmet.com","spamgourmet.net","spamgourmet.org","mailnull.com","mailnull.net","mailnesia.com","spamfree24.org","spamfree24.de","spamfree24.org","getnada.com","trashmail.com","trashmail.at","trashmail.io","trashmail.me","trashmail.net","trashmail.org","trashmail.xyz","trashmailer.com",
  // 10 minute mail variants
  "10minutemail.com","10minutemail.net","10minutemail.org","10minutemail.co.uk","10minutemail.de","10minutemail.info","10minutemail.ru","10minutemail.us","10minutemail.be","10minutemail.cf","10minutemail.ga","10minutemail.gq","10minutemail.ml","10minutemail.tk",
  // Others
  "mohmal.com","mailnull.com","spamevader.com","spam4.me","binkmail.com","bobmail.info","chammy.info","devnullmail.com","letthemeatspam.com","put2.net","suremail.info","tradermail.info","mail-temporaire.fr","jetable.com","jetable.net","jetable.org","jetable.de","filzmail.com","fakemail.net","mailismagic.com","spamgob.com","incognitomail.com","incognitomail.net","incognitomail.org","spamthisplease.com","tempemail.co","tempemail.net","spamhereplease.com","mailnew.com","maileater.com",
  // Extended fake/temp email list — 2024 updated
  "sharklasers.com","spam4.me","spamgob.com","mailnull.com",
  "deadaddress.com","sogetthis.com","noblepioneer.com","chacuo.net",
  "cuvox.de","dayrep.com","einrot.com","fleckens.hu","gustr.com",
  "superrito.com","teleworm.us","rhyta.com","armyspy.com",
  "cuvox.de","jourrapide.com","lavabit.com","hushmail.com",
  "spamgourmet.com","spamgourmet.net","spamgourmet.org",
  "mailme.lv","mailme24.com","mailmetrash.com","mailmoat.com",
  "mailnew.com","mailnull.com","mailscrap.com","mailshell.com",
  "mailsiphon.com","mailslite.com","mailtemp.net","mailzilla.com",
  "meltmail.com","mierdamail.com","mintemail.com","moncourrier.fr",
  "monemail.fr.nf","monmail.fr.nf","mt2009.com","mx0.wwwnew.eu",
  "mycleaninbox.net","mypartyclip.de","myphantomemail.com",
  "netmails.com","netmails.net","netzidiot.de","nh3.ro",
  "nice-4u.com","noclickemail.com","nogmailspam.info","nomail.pw",
  "nomail.xl.cx","nomail2me.com","nospamfor.us","nospammail.net",
  "notmailinator.com","nowmymail.com","objectmail.com","obobbo.com",
  "odaymail.com","oneoffemail.com","onewaymail.com","oopi.org",
  "pepbot.com","pookmail.com","prtnx.com","punkass.com",
  "putthisinyourspamdatabase.com","quickinbox.com","rcpt.at",
  "rtrtr.com","s0ny.net","safe-mail.net","safetymail.info",
  "safetypost.de","sandelf.de","schafmail.de","schrott-mail.de",
  "secretemail.de","secure-mail.biz","shortmail.net","shut.ws",
  "sibmail.com","skeefmail.com","slapsfromlastnight.com",
  "slopsbox.com","smashmail.de","smellfear.com","snkmail.com",
  "sofimail.com","sofort-mail.de","sogetthis.com","spam.la",
  "spam.su","spam4.me","spamavert.com","spambob.com","spambob.net",
  "spambob.org","spamcannon.com","spamcannon.net","spamcero.com",
  "spamcon.org","spamcorptastic.com","spamcowboy.com",
  "spamcowboy.net","spamcowboy.org","spamday.com","spamex.com",
  "spamfree.eu","spamgoes.in","spamhereplease.com","spamhole.com",
  "spamify.com","spaminator.de","spamkill.info","spammotel.com",
  "spamoff.de","spamslicer.com","spamspot.com","spamstack.net",
  "spamthisplease.com","spamtrail.com","speed.1s.fr","super-auswahl.de",
  "tempalias.com","tempe.ml","tempemail.biz","tempemail.co.uk",
  "tempinbox.co.uk","tempinbox.com","tempmail2.com","tempmailer.com",
  "tempmailer.de","tempomail.fr","temporaryemail.net",
  "temporaryemail.us","temporaryforwarding.com","temporaryinbox.com",
  "temporarymailaddress.com","tempthe.net","thanksnospam.info",
  "thecloudindex.com","thetempmail.com","throwam.com",
  "throwaway.email","tilien.com","tmail.com","tpwmail.net",
  "trash-me.com","trash-mail.at","trash-mail.cf","trash-mail.ga",
  "trash-mail.gq","trash-mail.io","trash-mail.ml","trash-mail.tk",
  "trashcanmail.com","trashdevil.com","trashdevil.net",
  "trashemail.de","trashimail.com","trashmail.fr","trashmail.io",
  "trashmail.me","trashmail.net","trashmail.org","trashmail.xyz",
  "trashmailer.com","trashmalware.com","trbvm.com","turual.com",
  "twinmail.de","tyldd.com","uggsrock.com","umail.net",
  "uroid.com","uteach.org","veryrealemail.com","viditag.com",
  "vipxp.cn","viral.ms","void.blackhole.dk","vpn.st","vubby.com",
  "wetrainbayarea.com","wetrainbayarea.org","whyspam.me",
  "willhackforfood.biz","willselfdestruct.com","winemaven.info",
  "wuzupmail.net","xemaps.com","xents.com","xmaily.com","xoxy.net",
  "xyzfree.net","yapped.net","yep.it","yogamaven.com","yopmail.fr",
  "yourdomain.com","yuurok.com","z1p.biz","za.com","zehnminutenmail.de",
  "zetmail.com","zippymail.info","zoemail.com","zoemail.net",
  "zoemail.org","zolly.de","zombie.com","zomg.info","zuvio.com"
]);

export function isTempEmail(email) {
  const e = (email || "").toLowerCase().trim();
  const domain = e.split("@")[1] || "";
  if (TEMP_EMAIL_DOMAINS.has(domain)) return true;
  const parts = domain.split(".");
  for (let i = 0; i < parts.length - 1; i++) {
    if (TEMP_EMAIL_DOMAINS.has(parts.slice(i).join("."))) return true;
  }
  return false;
}

export function generateRecoveryPin() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function generateUniqueRecoveryPin() {
  for (let i = 0; i < 100; i++) {
    const pin = generateRecoveryPin();
    const exists = await User.findOne({ recoveryPin: pin }).select("_id").lean();
    if (!exists) return pin;
  }
  throw new Error("Could not generate a unique recovery pin — please try again.");
}

export function generateUserToken(userId) {
  return jwt.sign({ userId: userId.toString() }, process.env.JWT_SECRET, { expiresIn: "7d" });
}

export function makePairKey(a, b) {
  const as = a.toString(), bs = b.toString();
  return as < bs ? `${as}_${bs}` : `${bs}_${as}`;
}

export function roomFromPairKey(k) {
  return "chat:" + k;
}

export async function assertConnected(userId, otherId) {
  if (!User) return false;
  const u = await User.findById(userId).select("connections").lean();
  return u ? (u.connections || []).some(x => x.toString() === otherId.toString()) : false;
}

export async function isUserBlockedBy(userId, blockerId) {
  if (!User) return false;
  const u = await User.findById(userId).select("blockedBy").lean();
  return u ? (u.blockedBy || []).some(x => x.toString() === blockerId.toString()) : false;
}
