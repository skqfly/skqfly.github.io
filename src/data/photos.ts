export interface Photo {
  src: string;
  width: number;
  height: number;
  alt: string;
  preview: string;
  previewLarge: string;
}

export const photoLibrary = {
  "carWindow": {
    "preview": "/photos/carWindow-480.webp",
    "previewLarge": "/photos/carWindow-960.webp",
    "src": "/photos/carWindow-full.webp",
    "width": 2560,
    "height": 1920,
    "alt": "夜色中亮起灯光的和平饭店外墙"
  },
  "caveLight": {
    "preview": "/photos/caveLight-480.webp",
    "previewLarge": "/photos/caveLight-960.webp",
    "src": "/photos/caveLight-full.webp",
    "width": 1920,
    "height": 2560,
    "alt": "手中拿着的一杯饮品"
  },
  "paperGeometry": {
    "preview": "/photos/paperGeometry-480.webp",
    "previewLarge": "/photos/paperGeometry-960.webp",
    "src": "/photos/paperGeometry-full.webp",
    "width": 2560,
    "height": 1920,
    "alt": "雨天撑着透明雨伞站在绿地旁的人"
  },
  "greenObject": {
    "preview": "/photos/greenObject-480.webp",
    "previewLarge": "/photos/greenObject-960.webp",
    "src": "/photos/greenObject-full.webp",
    "width": 2560,
    "height": 1920,
    "alt": "电影场记板和胶片装置前的人"
  },
  "coast": {
    "preview": "/photos/coast-480.webp",
    "previewLarge": "/photos/coast-960.webp",
    "src": "/photos/coast-full.webp",
    "width": 1920,
    "height": 2560,
    "alt": "高楼之间的两人合影"
  },
  "sunlitWalk": {
    "preview": "/photos/sunlitWalk-480.webp",
    "previewLarge": "/photos/sunlitWalk-960.webp",
    "src": "/photos/sunlitWalk-full.webp",
    "width": 2560,
    "height": 1920,
    "alt": "海边栏杆旁的人与远处海岸"
  },
  "glassCabinet": {
    "preview": "/photos/glassCabinet-480.webp",
    "previewLarge": "/photos/glassCabinet-960.webp",
    "src": "/photos/glassCabinet-full.webp",
    "width": 1920,
    "height": 2560,
    "alt": "东方明珠塔前的人"
  },
  "nightLights": {
    "preview": "/photos/nightLights-480.webp",
    "previewLarge": "/photos/nightLights-960.webp",
    "src": "/photos/nightLights-full.webp",
    "width": 1920,
    "height": 2560,
    "alt": "城市街头戴着眼镜的人"
  },
  "mountainView": {
    "preview": "/photos/mountainView-480.webp",
    "previewLarge": "/photos/mountainView-960.webp",
    "src": "/photos/mountainView-full.webp",
    "width": 2560,
    "height": 1920,
    "alt": "skqfly 摄影作品 9"
  },
  "eveningCoast": {
    "preview": "/photos/eveningCoast-480.webp",
    "previewLarge": "/photos/eveningCoast-960.webp",
    "src": "/photos/eveningCoast-full.webp",
    "width": 1920,
    "height": 2560,
    "alt": "skqfly 摄影作品 10"
  },
  "photoEleven": {
    "preview": "/photos/photoEleven-480.webp",
    "previewLarge": "/photos/photoEleven-960.webp",
    "src": "/photos/photoEleven-960.webp",
    "width": 1920,
    "height": 2560,
    "alt": "skqfly 摄影作品 11"
  },
  "photoTwelve": {
    "preview": "/photos/photoTwelve-480.webp",
    "previewLarge": "/photos/photoTwelve-960.webp",
    "src": "/photos/photoTwelve-960.webp",
    "width": 1920,
    "height": 2560,
    "alt": "skqfly 摄影作品 12"
  },
  "drone-green-hills": {
    "preview": "/photos/drone-green-hills-480.webp",
    "previewLarge": "/photos/drone-green-hills-960.webp",
    "src": "/photos/drone-green-hills-full.webp",
    "width": 2560,
    "height": 1920,
    "alt": "无人机镜头下的绿山与石屋"
  }
} satisfies Record<string, Photo>;

export const photos = Object.values(photoLibrary);
