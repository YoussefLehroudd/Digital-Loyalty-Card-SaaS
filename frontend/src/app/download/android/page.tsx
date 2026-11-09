import release from "@/lib/android-release.json";
import {AndroidDownloadContent} from "@/components/marketing/android-download-content";

export const metadata = {
  title: "Loyvance for Android — APK",
  description: "Official Loyvance Android app and installation instructions.",
};

export default function AndroidDownloadPage(){
 return <AndroidDownloadContent available={release.available} version={release.version}/>;
}
