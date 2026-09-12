export const BWC_DEVICE_TYPES = [
  'AXON_BODY_CAMERA',
  'MOTOROLA_BWC',
  'AXON_SIGNAL_PERIPHERAL',
  'DEI_BWC',
  'BT_IMAGING_DEVICE',
] as const;

export const DASHCAM_DEVICE_TYPES = ['DASHCAM'] as const;
export const RESIDENTIAL_CAM_DEVICE_TYPES = ['RESIDENTIAL_CAMERA'] as const;

export type SurveillanceDeviceType =
  | (typeof BWC_DEVICE_TYPES)[number]
  | (typeof DASHCAM_DEVICE_TYPES)[number]
  | (typeof RESIDENTIAL_CAM_DEVICE_TYPES)[number];
