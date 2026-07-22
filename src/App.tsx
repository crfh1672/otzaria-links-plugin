import React, { useState, useEffect } from 'react';
import { SessionState, PluginConfig } from './types';
import { runLinkingParser } from './utils/parserAlgorithm';
import { TopToolbar } from './components/TopToolbar';
import { SetupMode } from './components/SetupMode';
import { EditMode } from './components/EditMode';
import { ProjectsModal } from './components/ProjectsModal';
import { SingleHtmlExporterModal } from './components/SingleHtmlExporterModal';
import { saveToCache, notifySuccess, notifyError } from './utils/otzariaBridge';

export default function App() {
  const [mode, setMode] = useState<'setup' | 'edit'>('setup');
  const [session, setSession] = useState<SessionState | null>(null);

  // Modals state
  const [showProjectsModal, setShowProjectsModal] = useState(false);
  const [showHtmlExporterModal, setShowHtmlExporterModal] = useState(false);

  // Listen for Otzaria plugin events (plugin.boot, theme.changed)
  useEffect(() => {
    if (typeof window !== 'undefined' && window.Otzaria?.on) {
      window.Otzaria.on('plugin.boot', (payload: any) => {
        if (payload?.theme?.colorScheme) {
          applyThemeColors(payload.theme.colorScheme);
        }
      });

      window.Otzaria.on('theme.changed', (theme: any) => {
        if (theme?.colorScheme) {
          applyThemeColors(theme.colorScheme);
        }
      });
    }
  }, []);

  const applyThemeColors = (cs: any) => {
    const root = document.documentElement;
    if (cs.primary) root.style.setProperty('--color-primary', cs.primary);
    if (cs.surface) root.style.setProperty('--color-surface', cs.surface);
    if (cs.onSurface) root.style.setProperty('--color-on-surface', cs.onSurface);
  };

  // Run the 5-Step Parser algorithm and switch to Edit Mode
  const handleRunAlgorithm = (
    commentaryText: string,
    commentaryTitle: string,
    config: PluginConfig,
    sourceText: string,
    rashiText?: string,
    tosafotText?: string
  ) => {
    try {
      const parsed = runLinkingParser(
        commentaryText,
        sourceText,
        config,
        rashiText,
        tosafotText
      );

      const sessionId = `session_${Date.now()}`;
      const newSession: SessionState = {
        id: sessionId,
        commentaryFileName: `${commentaryTitle}.txt`,
        commentaryTitle,
        config,
        links: parsed.links,
        commentaryLines: parsed.commentaryLines,
        sourceLines: parsed.sourceLines,
        rashiLines: parsed.rashiLines,
        tosafotLines: parsed.tosafotLines,
        dhHighlights: parsed.dhHighlights,
        lastModifiedTimestamp: Date.now()
      };

      setSession(newSession);
      setMode('edit');
      notifySuccess(`אלגוריתם המיפוי הופעל בהצלחה: נוצרו ${parsed.links.length} קישורים`);
    } catch (e) {
      console.error(e);
      notifyError('אירעה שגיאה בעת הרצת האלגוריתם');
    }
  };

  const handleSaveSession = async () => {
    if (!session) return;
    try {
      const updated = { ...session, lastModifiedTimestamp: Date.now() };
      await saveToCache(session.id, updated);
      setSession(updated);
      notifySuccess('הפרויקט נשמר בהצלחה למטמון המקומי באוצריא');
    } catch (e) {
      console.error(e);
      notifyError('שגיאה בשמירת הפרויקט למטמון');
    }
  };

  const handleLoadSession = (loadedSession: SessionState) => {
    setSession(loadedSession);
    setMode('edit');
    notifySuccess(`פרויקט "${loadedSession.commentaryTitle}" נטען בהצלחה`);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans">
      {/* Top Fixed Toolbar */}
      <TopToolbar
        session={session}
        mode={mode}
        onSaveSession={handleSaveSession}
        onOpenProjects={() => setShowProjectsModal(true)}
        onOpenHtmlModal={() => setShowHtmlExporterModal(true)}
        onReturnToSetup={() => setMode('setup')}
      />

      {/* Main Mode View */}
      <main className="flex-1 pb-12">
        {mode === 'setup' ? (
          <SetupMode onRunAlgorithm={handleRunAlgorithm} />
        ) : (
          session && (
            <EditMode
              session={session}
              onUpdateSession={updated => {
                setSession(updated);
              }}
            />
          )
        )}
      </main>

      {/* Modals */}
      {showProjectsModal && (
        <ProjectsModal
          onLoadSession={handleLoadSession}
          onClose={() => setShowProjectsModal(false)}
        />
      )}

      {showHtmlExporterModal && (
        <SingleHtmlExporterModal
          onClose={() => setShowHtmlExporterModal(false)}
        />
      )}
    </div>
  );
}
