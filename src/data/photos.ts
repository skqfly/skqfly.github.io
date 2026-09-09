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
    "src": "https://img.mmddskq.top/file/blog/1784106117834_IMG_4339.JPG",
    "width": 2560,
    "height": 1920,
    "alt": "夜色中亮起灯光的和平饭店外墙"
  },
  "caveLight": {
    "preview": "/photos/caveLight-480.webp",
    "previewLarge": "/photos/caveLight-960.webp",
    "src": "https://img.mmddskq.top/file/blog/1784106119777_IMG_4555.JPG",
    "width": 1920,
    "height": 2560,
    "alt": "手中拿着的一杯饮品"
  },
  "paperGeometry": {
    "preview": "/photos/paperGeometry-480.webp",
    "previewLarge": "/photos/paperGeometry-960.webp",
    "src": "https://img.mmddskq.top/file/blog/1784106123200_IMG_20260603_160516.JPG",
    "width": 2560,
    "height": 1920,
    "alt": "雨天撑着透明雨伞站在绿地旁的人"
  },
  "greenObject": {
    "preview": "/photos/greenObject-480.webp",
    "previewLarge": "/photos/greenObject-960.webp",
    "src": "https://img.mmddskq.top/file/blog/1784106188171_IMG_20260606_163316.JPG",
    "width": 2560,
    "height": 1920,
    "alt": "电影场记板和胶片装置前的人"
  },
  "coast": {
    "preview": "/photos/coast-480.webp",
    "previewLarge": "/photos/coast-960.webp",
    "src": "https://img.mmddskq.top/file/blog/1784107108670_IMG_20260601_190827.JPG",
    "width": 1920,
    "height": 2560,
    "alt": "高楼之间的两人合影"
  },
  "sunlitWalk": {
    "preview": "/photos/sunlitWalk-480.webp",
    "previewLarge": "/photos/sunlitWalk-960.webp",
    "src": "https://img.mmddskq.top/file/blog/1784107109372_IMG_20260606_162539.JPG",
    "width": 2560,
    "height": 1920,
    "alt": "海边栏杆旁的人与远处海岸"
  },
  "glassCabinet": {
    "preview": "/photos/glassCabinet-480.webp",
    "previewLarge": "/photos/glassCabinet-960.webp",
    "src": "https://img.mmddskq.top/file/blog/1784107115373_IMG_4398.JPG",
    "width": 1920,
    "height": 2560,
    "alt": "东方明珠塔前的人"
  },
  "nightLights": {
    "preview": "/photos/nightLights-480.webp",
    "previewLarge": "/photos/nightLights-960.webp",
    "src": "https://img.mmddskq.top/file/blog/1784107114466_IMG_4461.JPG",
    "width": 1920,
    "height": 2560,
    "alt": "城市街头戴着眼镜的人"
  },
  "mountainView": {
    "preview": "/photos/mountainView-480.webp",
    "previewLarge": "/photos/mountainView-960.webp",
    "src": "https://img.mmddskq.top/file/blog/1784107112532_IMG_4516.JPG",
    "width": 2560,
    "height": 1920,
    "alt": "skqfly 摄影作品 9"
  },
  "eveningCoast": {
    "preview": "/photos/eveningCoast-480.webp",
    "previewLarge": "/photos/eveningCoast-960.webp",
    "src": "https://img.mmddskq.top/file/blog/1784107109272_IMG_20260601_190536.JPG",
    "width": 1920,
    "height": 2560,
    "alt": "skqfly 摄影作品 10"
  },
  "photoEleven": {
    "preview": "/photos/photoEleven-480.webp",
    "previewLarge": "/photos/photoEleven-960.webp",
    "src": "https://img.mmddskq.top/file/img/1785310322363_IMG_5783.JPG",
    "width": 1920,
    "height": 2560,
    "alt": "skqfly 摄影作品 11"
  },
  "photoTwelve": {
    "preview": "/photos/photoTwelve-480.webp",
    "previewLarge": "/photos/photoTwelve-960.webp",
    "src": "https://img.mmddskq.top/file/img/1785310318490_IMG_5771.JPG",
    "width": 1920,
    "height": 2560,
    "alt": "skqfly 摄影作品 12"
  }
} satisfies Record<string, Photo>;

export const photos = Object.values(photoLibrary);
