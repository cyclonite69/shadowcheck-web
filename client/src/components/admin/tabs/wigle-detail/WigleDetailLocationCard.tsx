import React from 'react';
import type { WigleDetailData } from '../../hooks/useWigleDetail';

export interface WigleDetailLocationCardProps {
  data: WigleDetailData;
}

export const WigleDetailLocationCard: React.FC<WigleDetailLocationCardProps> = ({ data }) => {
  if (!data.streetAddress) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="bg-slate-800/40 p-4 rounded border border-slate-700/50">
        <h4 className="text-xs font-bold text-slate-400 uppercase mb-3">Address Intelligence</h4>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-500">Street:</span>
            <span className="text-slate-200">
              {data.streetAddress.housenumber} {data.streetAddress.road}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">City:</span>
            <span className="text-slate-200">{data.streetAddress.city}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Region:</span>
            <span className="text-slate-200">
              {data.streetAddress.region}, {data.streetAddress.country}{' '}
              {data.streetAddress.postalcode}
            </span>
          </div>
        </div>
      </div>

      <div className="bg-slate-800/40 p-4 rounded border border-slate-700/50">
        <h4 className="text-xs font-bold text-slate-400 uppercase mb-3">Trilateration</h4>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-500">Latitude:</span>
            <span className="text-cyan-300 font-mono">{data.trilateratedLatitude}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Longitude:</span>
            <span className="text-cyan-300 font-mono">{data.trilateratedLongitude}</span>
          </div>
          <div className="mt-3 pt-2 border-t border-slate-700/50 text-xs text-slate-500">
            Based on signal clustering analysis
          </div>
        </div>
      </div>
    </div>
  );
};
