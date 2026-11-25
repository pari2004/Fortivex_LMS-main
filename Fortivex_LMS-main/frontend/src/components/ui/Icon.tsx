"use client";

import React from "react";

interface IconProps {
  name: string;
  size?: number | string;
  color?: string;
  style?: React.CSSProperties;
  className?: string;
}

export function Icon({ name, size = 20, color = "currentColor", style, className }: IconProps) {
  const pixelSize = typeof size === "number" ? `${size}px` : size;

  const svgStyle: React.CSSProperties = {
    width: pixelSize,
    height: pixelSize,
    display: "inline-block",
    verticalAlign: "middle",
    flexShrink: 0,
    fill: "currentColor",
    ...style,
  };

  switch (name) {
    case "auto_stories":
      return (
        <svg viewBox="0 0 24 24" style={svgStyle} className={className} color={color}>
          <path d="M19 1l-5 5v11l5-4.5V1zM1 6v14.5A2.5 2.5 0 0 0 3.5 23H10V6H3.5A2.5 2.5 0 0 0 1 6zm22 0a2.5 2.5 0 0 0-2.5-2.5H14v17h6.5A2.5 2.5 0 0 0 23 18V6zM3.5 8H8v13H3.5A1.5 1.5 0 0 1 2 19.5v-11A1.5 1.5 0 0 1 3.5 8z" />
        </svg>
      );

    case "dashboard":
    case "grid_view":
      return (
        <svg viewBox="0 0 24 24" style={svgStyle} className={className} color={color}>
          <path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z" />
        </svg>
      );

    case "menu_book":
    case "library_books":
      return (
        <svg viewBox="0 0 24 24" style={svgStyle} className={className} color={color}>
          <path d="M21 5c-1.11-.35-2.33-.5-3.5-.5-1.95 0-4.05.4-5.5 1.5-1.45-1.1-3.55-1.5-5.5-1.5S2.45 4.9 1 6v14.65c0 .25.25.5.5.5.1 0 .15-.05.25-.05C3.1 20.45 5.05 20 6.5 20c1.95 0 4.05.4 5.5 1.5 1.35-.85 3.8-1.5 5.5-1.5 1.65 0 3.35.3 4.75 1.05.1.05.15.05.25.05.25 0 .5-.25.5-.5V6c-.6-.45-1.25-.75-2-1zm0 13.5c-1.1-.35-2.3-.5-3.5-.5-1.7 0-4.15.65-5.5 1.5V8c1.35-.85 3.8-1.5 5.5-1.5 1.2 0 2.4.15 3.5.5v11.5z" />
        </svg>
      );

    case "groups":
    case "group":
    case "school":
      return (
        <svg viewBox="0 0 24 24" style={svgStyle} className={className} color={color}>
          <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
        </svg>
      );

    case "assignment":
    case "pending_actions":
      return (
        <svg viewBox="0 0 24 24" style={svgStyle} className={className} color={color}>
          <path d="M19 3h-4.18C14.4 1.84 13.3 1 12 1c-1.3 0-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm2 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z" />
        </svg>
      );

    case "folder_open":
    case "cloud_download":
      return (
        <svg viewBox="0 0 24 24" style={svgStyle} className={className} color={color}>
          <path d="M20 6h-8l-2-2H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm0 12H4V8h16v10z" />
        </svg>
      );

    case "videocam":
    case "video_camera_front":
      return (
        <svg viewBox="0 0 24 24" style={svgStyle} className={className} color={color}>
          <path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z" />
        </svg>
      );

    case "forum":
    case "chat_bubble":
      return (
        <svg viewBox="0 0 24 24" style={svgStyle} className={className} color={color}>
          <path d="M21 6h-2v9H6v2c0 .55.45 1 1 1h11l4 4V7c0-.55-.45-1-1-1zm-4 6V3c0-.55-.45-1-1-1H3c-.55 0-1 .45-1 1v14l4-4h10c.55 0 1-.45 1-1z" />
        </svg>
      );

    case "badge":
    case "account_circle":
    case "person":
      return (
        <svg viewBox="0 0 24 24" style={svgStyle} className={className} color={color}>
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z" />
        </svg>
      );

    case "person_add":
      return (
        <svg viewBox="0 0 24 24" style={svgStyle} className={className} color={color}>
          <path d="M15 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm-9-2V7H4v3H1v2h3v3h2v-3h3v-2H6zm9 4c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
        </svg>
      );

    case "insights":
    case "bar_chart":
      return (
        <svg viewBox="0 0 24 24" style={svgStyle} className={className} color={color}>
          <path d="M5 9.2h3V19H5zM10.6 5h2.8v14h-2.8zm5.6 8H19v6h-2.8z" />
        </svg>
      );

    case "tune":
    case "settings":
      return (
        <svg viewBox="0 0 24 24" style={svgStyle} className={className} color={color}>
          <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" />
        </svg>
      );

    case "search":
      return (
        <svg viewBox="0 0 24 24" style={svgStyle} className={className} color={color}>
          <path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
        </svg>
      );

    case "notifications":
      return (
        <svg viewBox="0 0 24 24" style={svgStyle} className={className} color={color}>
          <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2zm-2 1H8v-6c0-2.48 1.51-4.5 4-4.5s4 2.02 4 4.5v6z" />
        </svg>
      );

    case "logout":
      return (
        <svg viewBox="0 0 24 24" style={svgStyle} className={className} color={color}>
          <path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z" />
        </svg>
      );

    case "expand_more":
      return (
        <svg viewBox="0 0 24 24" style={svgStyle} className={className} color={color}>
          <path d="M16.59 8.59L12 13.17 7.41 8.59 6 10l6 6 6-6z" />
        </svg>
      );

    case "expand_less":
      return (
        <svg viewBox="0 0 24 24" style={svgStyle} className={className} color={color}>
          <path d="M12 8l-6 6 1.41 1.41L12 10.83l4.59 4.58L18 14z" />
        </svg>
      );

    case "close":
      return (
        <svg viewBox="0 0 24 24" style={svgStyle} className={className} color={color}>
          <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
        </svg>
      );

    case "check":
    case "check_circle":
    case "verified":
    case "done_all":
      return (
        <svg viewBox="0 0 24 24" style={svgStyle} className={className} color={color}>
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
        </svg>
      );

    case "quiz":
      return (
        <svg viewBox="0 0 24 24" style={svgStyle} className={className} color={color}>
          <path d="M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-6 13h-2v-2h2v2zm1.07-5.75l-.9.92C13.45 10.9 13 11.5 13 13h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H8c0-2.21 1.79-4 4-4s4 1.79 4 4c0 .88-.36 1.68-.93 2.25z" />
        </svg>
      );

    case "calendar_today":
    case "calendar_month":
    case "event":
      return (
        <svg viewBox="0 0 24 24" style={svgStyle} className={className} color={color}>
          <path d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM7 10h5v5H7z" />
        </svg>
      );

    case "travel_explore":
      return (
        <svg viewBox="0 0 24 24" style={svgStyle} className={className} color={color}>
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" />
        </svg>
      );

    case "military_tech":
    case "emoji_events":
      return (
        <svg viewBox="0 0 24 24" style={svgStyle} className={className} color={color}>
          <path d="M19 5h-2V3H7v2H5c-1.1 0-2 .9-2 2v1c0 2.55 1.92 4.63 4.39 4.94A5.01 5.01 0 0 0 11 15.9V19H7v2h10v-2h-4v-3.1a5.01 5.01 0 0 0 3.61-4.96C19.08 10.63 21 8.55 21 8V7c0-1.1-.9-2-2-2zM5 8V7h2v3.82C5.84 10.4 5 9.3 5 8zm14 0c0 1.3-.84 2.4-2 2.82V7h2v1z" />
        </svg>
      );

    case "add":
      return (
        <svg viewBox="0 0 24 24" style={svgStyle} className={className} color={color}>
          <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
        </svg>
      );

    default:
      // Fallback: render Material Symbol with strict styles so it does not spill text
      return (
        <span
          className={`material-symbols-outlined ${className || ""}`}
          style={{
            fontSize: pixelSize,
            width: pixelSize,
            height: pixelSize,
            lineHeight: 1,
            overflow: "hidden",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            color,
            ...style,
          }}
        >
          {name}
        </span>
      );
  }
}
