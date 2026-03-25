import type { Request, Response, NextFunction } from 'express';
/**
 * Threat Report Routes (v1)
 * Generates per-network report output as JSON, Markdown, HTML, or PDF.
 */

import express from 'express';
const router = express.Router();
const { threatReportService } = require('../../../config/container');
import { validateBSSID } from '../../../validation/schemas';
const { asyncHandler } = require('../../../utils/asyncHandler');

type ThreatReportParams = {
  bssid: string;
};

router.get(
  '/reports/threat/:bssid',
  asyncHandler(async (req: Request<ThreatReportParams>, res: Response) => {
    try {
      const bssidValidation = validateBSSID(req.params.bssid);
      if (!bssidValidation.valid) {
        return res.status(400).json({ error: bssidValidation.error });
      }
      if (!bssidValidation.cleaned) {
        return res.status(400).json({ error: 'Invalid BSSID format' });
      }

      const cleanBssid = bssidValidation.cleaned;
      const report = await threatReportService.getThreatReportData(cleanBssid);
      if (!report) {
        return res.status(404).json({ error: `Network not found for ${cleanBssid}` });
      }

      const format = String(req.query.format || 'json').toLowerCase();
      const safeBssid = cleanBssid.replace(/:/g, '_');

      if (format === 'md' || format === 'markdown') {
        const markdown = threatReportService.renderMarkdown(report);
        res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
        res.setHeader(
          'Content-Disposition',
          `attachment; filename="threat_report_${safeBssid}.md"`
        );
        return res.send(markdown);
      }

      if (format === 'html') {
        const html = threatReportService.renderHtml(report);
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader(
          'Content-Disposition',
          `attachment; filename="threat_report_${safeBssid}.html"`
        );
        return res.send(html);
      }

      if (format === 'pdf') {
        try {
          const pdfBuffer = await threatReportService.renderPdfBuffer(report);
          res.setHeader('Content-Type', 'application/pdf');
          res.setHeader(
            'Content-Disposition',
            `attachment; filename="threat_report_${safeBssid}.pdf"`
          );
          return res.send(pdfBuffer);
        } catch (error: any) {
          if (error?.code === 'PDFKIT_NOT_INSTALLED' || error?.message === 'PDFKIT_NOT_INSTALLED') {
            return res.status(503).json({
              error: 'PDF generation dependency is not installed in this environment.',
              install: 'npm install pdfkit',
            });
          }
          throw error;
        }
      }

      return res.json({
        ok: true,
        format: 'json',
        report,
      });
    } catch (err: any) {
      return res.status(500).json({
        error: err?.message || 'Threat report generation failed',
      });
    }
  })
);

export default router;
