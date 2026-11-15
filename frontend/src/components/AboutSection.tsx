import React from "react";
import type { TeamInfo } from "../types";
import { Users, BookOpen, ExternalLink, ShieldAlert } from "lucide-react";

interface Props {
  team: TeamInfo;
}

export const AboutSection: React.FC<Props> = ({ team }) => {
  return (
    <div className="space-y-6">
      {/* Institution & Course Banner */}
      <div className="bg-white border border-[#E5E1DA] rounded-xl p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 mb-5 border-b border-[#E5E1DA] gap-3">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 rounded-xl bg-[#1A237E] text-white flex items-center justify-center font-serif font-bold text-xl shadow-xs">
              SRM
            </div>
            <div>
              <h3 className="text-lg font-bold text-[#1A237E] font-serif">
                SRM Institute of Science & Technology
              </h3>
              <p className="text-xs text-[#5F5F5F]">
                {team.department} • Course: {team.course} • {team.batch}
              </p>
            </div>
          </div>

          <div className="text-right">
            <span className="text-xs font-mono font-bold bg-[#FAF9F6] border border-[#E5E1DA] px-3 py-1.5 rounded-full text-[#00695C]">
              Batch 9 Machine Learning Project
            </span>
          </div>
        </div>

        {/* Project Title */}
        <div className="mb-6">
          <h2 className="text-xl font-bold font-serif text-[#1A237E] tracking-tight">
            Renewable Energy Production Pattern Discovery Using PCA and Gaussian Mixture Models
          </h2>
          <p className="text-xs text-[#5F5F5F] mt-1 italic font-serif">
            A study of weather-linked solar and wind generation patterns across 315,648 time-series observations
          </p>
        </div>

        {/* Project Team Members Grid */}
        <div>
          <h4 className="text-xs font-bold text-[#5F5F5F] uppercase tracking-wider mb-3 flex items-center space-x-1.5">
            <Users className="w-4 h-4 text-[#00695C]" />
            <span>Project Team Members</span>
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {team.members.map((member) => (
              <div
                key={member.reg_no}
                className="bg-[#FAF9F6] border border-[#E5E1DA] rounded-lg p-3.5 hover:border-[#1A237E] transition shadow-2xs"
              >
                <div className="font-bold text-[#1A237E] text-sm">{member.name}</div>
                <div className="text-xs font-mono font-bold text-[#00695C] mt-0.5">
                  {member.reg_no}
                </div>
                <div className="text-[11px] text-[#5F5F5F] mt-1.5">{member.role}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Dataset & Academic Methodology */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-[#E5E1DA] rounded-xl p-5 shadow-xs space-y-3">
          <h4 className="text-sm font-bold text-[#1A237E] font-serif flex items-center space-x-2">
            <BookOpen className="w-4 h-4 text-[#00695C]" />
            <span>Public Data Source Citation</span>
          </h4>

          <div className="text-xs text-[#252525] space-y-2 leading-relaxed">
            <p>
              <strong>Dataset:</strong> Renewable Energy and Electricity Demand Time Series Dataset with Exogenous Variables at 5-minute Interval.
            </p>
            <p>
              <strong>Mendeley Data DOI:</strong>{" "}
              <a
                href="https://doi.org/10.17632/fdfftr3tc2.1"
                target="_blank"
                rel="noreferrer"
                className="text-[#1A237E] underline font-mono inline-flex items-center space-x-1"
              >
                <span>10.17632/fdfftr3tc2.1</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </p>
            <p>
              <strong>Geographic Scope:</strong> CAISO and NREL-derived solar, wind, and atmospheric records (2019–2021).
            </p>
            <p>
              <strong>Record Volume:</strong> 315,648 raw 5-minute rows aggregated to 26,304 hourly mean observations with 0 missing values.
            </p>
          </div>
        </div>

        <div className="bg-white border border-[#E5E1DA] rounded-xl p-5 shadow-xs space-y-3">
          <h4 className="text-sm font-bold text-[#1A237E] font-serif flex items-center space-x-2">
            <ShieldAlert className="w-4 h-4 text-[#B78B24]" />
            <span>Documented Limitations & Scope Constraints</span>
          </h4>

          <div className="text-xs text-[#5F5F5F] space-y-1.5 leading-relaxed">
            <p>
              • <strong>Historical Dataset:</strong> Data coverage concludes at 2021-12-31. The system does not imply streaming or real-time grid feeds.
            </p>
            <p>
              • <strong>Unsupervised Clustering:</strong> GMM models contemporaneous operating regimes; it does not forecast future MW output or prove causality.
            </p>
            <p>
              • <strong>Hourly Aggregation:</strong> Mean resampling reduces sub-hourly sensor noise but smooths out fast 5-minute ramp spikes.
            </p>
            <p>
              • <strong>Untouched Test Period:</strong> Final 15% (3,947 hours: July–Dec 2021) was held completely unused for future validation.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
