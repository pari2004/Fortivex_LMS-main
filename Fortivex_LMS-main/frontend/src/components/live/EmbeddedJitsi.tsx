"use client";

import { useEffect, useRef, useState } from "react";
import { JitsiMeeting } from "@jitsi/react-sdk";
import { useAuth } from "@/lib/auth/AuthContext";

interface EmbeddedJitsiProps {
  roomName: string;
  isHost?: boolean;
  onLeave?: () => void;
}

export function EmbeddedJitsi({ roomName, isHost = false, onLeave }: EmbeddedJitsiProps) {
  const { user } = useAuth();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // A small delay to ensure the container is fully rendered before injecting Jitsi
    const timer = setTimeout(() => setReady(true), 100);
    return () => clearTimeout(timer);
  }, []);

  if (!ready || !user) {
    return (
      <div style={{ height: "600px", width: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#111", color: "#fff", borderRadius: "12px" }}>
        Preparing Meeting Room...
      </div>
    );
  }

  // Determine user role and features
  const userInfo = {
    displayName: user.full_name,
    email: user.email,
  };

  return (
    <div style={{ width: "100%", height: "700px", background: "#000", borderRadius: "12px", overflow: "hidden" }}>
      <JitsiMeeting
        domain={process.env.NEXT_PUBLIC_JITSI_DOMAIN || "meet.systemli.org"}
        roomName={roomName}
        configOverwrite={{
          startWithAudioMuted: false,
          startWithVideoMuted: false,
          disableModeratorIndicator: false,
          prejoinPageEnabled: false,
          prejoinConfig: { enabled: false },
          requireDisplayName: false,
          enableFeaturesBasedOnToken: false,
          enableLobby: false,
          disableRemoteMute: !isHost,
          disableScreensharing: !isHost,
          remoteVideoMenu: {
            disableKick: !isHost,
            disableGrantModerator: false
          },
          participantsPane: {
            hideModeratorSettingsTab: !isHost,
            hideMoreActionsButton: !isHost,
            hideMuteAllButton: !isHost
          }
        }}
        interfaceConfigOverwrite={{
          DISABLE_JOIN_LEAVE_NOTIFICATIONS: true,
          SHOW_PROMOTIONAL_CLOSE_PAGE: false,
          SHOW_JITSI_WATERMARK: false,
          SHOW_PREJOIN_PAGE: false,
          TOOLBAR_BUTTONS: isHost 
            ? ['camera', 'chat', 'closedcaptions', 'desktop', 'download', 'embedmeeting', 'etherpad', 'feedback', 'filmstrip', 'fullscreen', 'hangup', 'help', 'highlight', 'invite', 'linktosalesforce', 'livestreaming', 'microphone', 'noisesuppression', 'participants-pane', 'profile', 'raisehand', 'recording', 'security', 'select-background', 'settings', 'shareaudio', 'sharedvideo', 'shortcuts', 'stats', 'tileview', 'toggle-camera', 'videoquality']
            : ['camera', 'chat', 'closedcaptions', 'feedback', 'filmstrip', 'fullscreen', 'hangup', 'help', 'microphone', 'noisesuppression', 'participants-pane', 'profile', 'raisehand', 'select-background', 'settings', 'shortcuts', 'stats', 'tileview', 'toggle-camera', 'videoquality'],
          SETTINGS_SECTIONS: isHost
            ? ['devices', 'language', 'moderator', 'profile', 'calendar', 'sounds']
            : ['devices', 'language', 'profile', 'calendar', 'sounds']
        }}
        userInfo={userInfo}
        getIFrameRef={(iframeRef: any) => {
          iframeRef.style.height = "100%";
          iframeRef.style.width = "100%";
        }}
        onReadyToClose={() => {
          if (onLeave) onLeave();
        }}
        onApiReady={(externalApi: any) => {
          externalApi.addListener("videoConferenceJoined", () => {
             console.log("Joined conference");
          });
          externalApi.addListener("readyToClose", () => {
             if (onLeave) onLeave();
          });
        }}
      />
    </div>
  );
}
