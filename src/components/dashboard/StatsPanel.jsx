import { 
  Box,
  Tooltip,
  Typography,
  Card,
  CardContent,
  LinearProgress,
  useTheme 
} from '@mui/material';
import {
  FormatListBulleted as EventsIcon,
  Assignment as FieldsIcon,
  CheckCircle as CompletedIcon,
  TrendingUp as ProgressIcon
} from '@mui/icons-material';

// StatsCard component remains the same
const StatsCard = ({ 
  title, 
  value, 
  icon: Icon, 
  tooltip = '', 
  trend = null, 
  color = 'primary.main'
}) => {
  const theme = useTheme();
  
  return (
    <Card 
      elevation={0}
      sx={{ 
        flexGrow: 1, 
        minWidth: { xs: '100%', sm: '200px' },
        backgroundColor: `${theme.palette.background.paper}`,
        border: 1,
        borderColor: theme.palette.divider,
        transition: 'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
        '&:hover': {
          transform: 'translateY(-2px)',
          boxShadow: theme.shadows[2],
        }
      }}
    >
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
          <Tooltip title={tooltip} arrow placement="top">
            <Box>
              <Typography 
                variant="subtitle2" 
                color="text.secondary"
                sx={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: 1,
                  fontWeight: 500
                }}
              >
                {title}
              </Typography>
            </Box>
          </Tooltip>
          <Icon sx={{ color: color }} />
        </Box>

        <Typography 
          variant="h4" 
          component="div" 
          sx={{ 
            fontWeight: 600,
            color: theme.palette.text.primary,
            mb: 1
          }}
        >
          {typeof value === 'number' ? value.toLocaleString() : value}
        </Typography>

        {trend !== null && (
          <Box sx={{ mt: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
              <Typography 
                variant="caption" 
                color="text.secondary"
                sx={{ flexGrow: 1 }}
              >
                Progress
              </Typography>
              <Typography 
                variant="caption" 
                color="text.secondary"
              >
                {trend}%
              </Typography>
            </Box>
            <LinearProgress 
              variant="determinate" 
              value={trend} 
              sx={{
                height: 4,
                borderRadius: 2,
                bgcolor: theme.palette.grey[100],
                '& .MuiLinearProgress-bar': {
                  bgcolor: color
                }
              }}
            />
          </Box>
        )}
      </CardContent>
    </Card>
  );
};

const calculateStats = (files = []) => {
  return files.reduce((stats, file) => {
    // Count total events
    const totalEventsInFile = file.abstracts?.reduce((sum, abstract) => 
      sum + (abstract.events?.length || 0), 0) || 0;

    // Count fields per event
    const fieldsPerEvent = 14; // Main Action + Arguments fields (12) + Text + Type
    const totalFieldsInFile = totalEventsInFile * fieldsPerEvent;

    // Calculate annotated fields based on progress
    const annotatedFieldsInFile = Math.floor((file.progress || 0) * totalFieldsInFile / 100);

    return {
      totalEvents: stats.totalEvents + totalEventsInFile,
      totalFields: stats.totalFields + totalFieldsInFile,
      annotatedFields: stats.annotatedFields + annotatedFieldsInFile,
      completedFiles: stats.completedFiles + (file.progress === 100 ? 1 : 0),
      totalFiles: stats.totalFiles + 1,
      totalAnnotations: stats.totalAnnotations + annotatedFieldsInFile,
      targetAnnotations: stats.targetAnnotations + totalFieldsInFile
    };
  }, {
    totalEvents: 0,
    totalFields: 0,
    annotatedFields: 0,
    completedFiles: 0,
    totalFiles: 0,
    totalAnnotations: 0,
    targetAnnotations: 0
  });
};

const StatsPanel = ({ files = [], loading = false }) => {
  const theme = useTheme();
  const stats = calculateStats(files);

  const statsConfig = [
    {
      title: 'Total Events',
      value: stats.totalEvents,
      icon: EventsIcon,
      tooltip: 'Total number of events across all files',
      color: theme.palette.primary.main
    },
    {
      title: 'Annotation Fields',
      value: stats.totalFields,
      icon: FieldsIcon,
      tooltip: 'Total number of fields to be annotated',
      trend: stats.totalFields > 0 ? Math.round((stats.annotatedFields / stats.totalFields) * 100) : 0,
      color: theme.palette.info.main
    },
    {
      title: 'Completed Files',
      value: stats.completedFiles,
      icon: CompletedIcon,
      tooltip: 'Files with all annotations completed',
      trend: stats.totalFiles > 0 ? Math.round((stats.completedFiles / stats.totalFiles) * 100) : 0,
      color: theme.palette.success.main
    },
    {
      title: 'Overall Progress',
      value: `${stats.totalAnnotations} / ${stats.targetAnnotations}`,
      icon: ProgressIcon,
      tooltip: 'Total annotation progress across all files',
      trend: stats.targetAnnotations > 0 ? Math.round((stats.totalAnnotations / stats.targetAnnotations) * 100) : 0,
      color: theme.palette.warning.main
    }
  ];

  return (
    <Box 
      sx={{ 
        display: 'grid',
        gridTemplateColumns: {
          xs: '1fr',
          sm: '1fr 1fr',
          md: 'repeat(4, 1fr)'
        },
        gap: 2,
        mb: 4,
        opacity: loading ? 0.7 : 1,
        transition: 'opacity 0.2s ease-in-out'
      }}
    >
      {statsConfig.map((stat) => (
        <StatsCard
          key={stat.title}
          {...stat}
          value={loading ? '-' : stat.value}
        />
      ))}
    </Box>
  );
};

export default StatsPanel;