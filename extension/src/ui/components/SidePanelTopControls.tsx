import IconButton from '@mui/material/IconButton';
import HistoryIcon from '@mui/icons-material/History';
import LoadSubtitlesIcon from '@project/common/components/LoadSubtitlesIcon';
import SaveAltIcon from '@mui/icons-material/SaveAlt';
import ImportExportIcon from '@mui/icons-material/ImportExport';
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import KeyIcon from "@mui/icons-material/Key";
import BarChartIcon from '@mui/icons-material/BarChart';
import Grid from '@mui/material/Grid';
import Box from '@mui/material/Box';
import Fade from '@mui/material/Fade';
import Badge from '@mui/material/Badge';
import { ForwardedRef, useEffect, useState } from 'react';
import React from 'react';
import Tooltip from '@project/common/components/Tooltip';
import { useTranslation } from 'react-i18next';

interface Props {
    show: boolean;
    canDownloadSubtitles: boolean;
    onLoadSubtitles: () => void;
    onDownloadSubtitles: () => void;
    onBulkExportSubtitles: () => void;
    onShowMiningHistory: () => void;
    miningHistoryCount: number;
    onShowStatistics: () => void;
    onOpenApiKeyDialog?: () => void;
    onTopPhrases?: () => void;
    disableBulkExport?: boolean;
}

const SidePanelTopControls = React.forwardRef(function SidePanelTopControls(
    {
        show,
        canDownloadSubtitles,
        onLoadSubtitles,
        onDownloadSubtitles,
        onBulkExportSubtitles,
        onShowMiningHistory,
        miningHistoryCount,
        onShowStatistics,
        disableBulkExport,
        onOpenApiKeyDialog,
        onTopPhrases,
    }: Props,
    ref: ForwardedRef<HTMLDivElement>
) {
    const { t } = useTranslation();
    const [forceShow, setForceShow] = useState<boolean>(true);

    useEffect(() => {
        const timeoutId = setTimeout(() => setForceShow(false), 1000);
        return () => clearTimeout(timeoutId);
    }, []);

    return (
            <Box ref={ref} style={{ position: 'sticky', top: 0, zIndex: 1000, background: 'rgba(30,30,30,0.95)', borderBottom: '1px solid rgba(255,255,255,0.1)', padding: '4px 8px' }}>
                <Grid container direction="row" justifyContent="center" alignItems="center" spacing={1}>
                    <Grid item>
                        <Tooltip title={t('action.loadSubtitles')!}>
                            <IconButton onClick={onLoadSubtitles}>
                                <LoadSubtitlesIcon />
                            </IconButton>
                        </Tooltip>
                    </Grid>
                    {canDownloadSubtitles && (
                        <>
                            <Grid item>
                                <Tooltip title={t('action.downloadSubtitlesAsSrt')!}>
                                    <IconButton onClick={onDownloadSubtitles}>
                                        <SaveAltIcon />
                                    </IconButton>
                                </Tooltip>
                            </Grid>
                            <Grid item>
                                <Tooltip title={t('action.bulkExportSubtitles')!} disabled={!!disableBulkExport}>
                                    <span>
                                        <IconButton onClick={onBulkExportSubtitles} disabled={!!disableBulkExport}>
                                            <ImportExportIcon />
                                        </IconButton>
                                    </span>
                                </Tooltip>
                            </Grid>
                        </>
                    )}
                    <Grid item>
                        <IconButton onClick={onShowMiningHistory}>
                            <Tooltip title={t('bar.miningHistory')!}>
                                <Badge badgeContent={miningHistoryCount} color="default" showZero>
                                    <HistoryIcon />
                                </Badge>
                            </Tooltip>
                        </IconButton>
                    </Grid>
                    <Grid item>
                        <IconButton onClick={onShowStatistics}>
                            <Tooltip title={t('statistics.title')!}>
                                <BarChartIcon />
                            </Tooltip>
                        </IconButton>
                    </Grid>
                    {onTopPhrases && (
                        <Grid item>
                            <IconButton onClick={onTopPhrases}>
                                <Tooltip title="Top Phrases to Learn">
                                    <AutoAwesomeIcon />
                                </Tooltip>
                            </IconButton>
                        </Grid>
                    )}
                    {onOpenApiKeyDialog && (
                        <Grid item>
                            <IconButton onClick={onOpenApiKeyDialog}>
                                <Tooltip title="AI API Key">
                                    <KeyIcon />
                                </Tooltip>
                            </IconButton>
                        </Grid>
                    )}
                </Grid>
            </Box>
    );
});

export default SidePanelTopControls;
