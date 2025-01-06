// src/components/dashboard/StatsPanel.jsx
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

// src/components/dashboard/StatsPanel.jsx
// ... existing imports remain the same ...

// Constants for field counting
const EVENT_TYPE_FIELDS = [
  'Background/Introduction',
  'Methods/Approach', 
  'Results/Findings',
  'Conclusions/Implications'
];

const ARGUMENT_FIELDS = [
  'Agent',
  'Context',
  'Purpose',
  'Method',
  'Results',
  'Analysis',
  'Challenge',
  'Ethical',
  'Implications',
  'Contradictions'
];

const OBJECT_FIELDS = [
  'Base Object',
  'Base Modifier',
  'Attached Object',
  'Attached Modifier'
];

// Updated field counting logic
const countFieldsInEvent = (event) => {
  let fieldCount = 0;

  // Count event type fields that are present
  EVENT_TYPE_FIELDS.forEach(field => {
    if (event[field] && event[field].trim() !== '') {
      fieldCount++;
    }
  });

  // Count Main Action if present
  if (event['Main Action'] && event['Main Action'].trim() !== '') {
    fieldCount++;
  }

  // Count Arguments fields
  if (event.Arguments) {
    ARGUMENT_FIELDS.forEach(field => {
      if (event.Arguments[field] && event.Arguments[field].trim() !== '') {
        fieldCount++;
      }
    });

    // Count Object fields
    if (event.Arguments.Object) {
      OBJECT_FIELDS.forEach(field => {
        if (event.Arguments.Object[field] && event.Arguments.Object[field].trim() !== '') {
          fieldCount++;
        }
      });
    }
  }

  return fieldCount;
};

const countEventsInFile = (file) => {
  if (!file?.abstracts?.length) {
    console.log('No abstracts found in file:', file?.name);
    return { events: 0, fields: 0 };
  }

  let totalEvents = 0;
  let totalFields = 0;

  file.abstracts.forEach((abstract, abstractIndex) => {
    if (!abstract?.events?.length) {
      console.log(`No events in abstract ${abstractIndex} of file:`, file.name);
      return;
    }

    const eventsInAbstract = abstract.events.length;
    const fieldsInAbstract = abstract.events.reduce((sum, event) => {
      return sum + countFieldsInEvent(event);
    }, 0);

    console.log(`Abstract ${abstractIndex} stats:`, {
      events: eventsInAbstract,
      fields: fieldsInAbstract
    });

    totalEvents += eventsInAbstract;
    totalFields += fieldsInAbstract;
  });

  console.log(`File ${file.name} totals:`, {
    events: totalEvents,
    fields: totalFields
  });

  return { events: totalEvents, fields: totalFields };
};

const calculateStats = (files = []) => {
  console.log('Calculating stats for files:', files.length);

  return files.reduce((stats, file) => {
    const { events, fields } = countEventsInFile(file);
    
    // Calculate annotated fields based on progress
    const annotatedFields = Math.floor((file.progress || 0) * fields / 100);

    const newStats = {
      totalEvents: stats.totalEvents + events,
      totalFields: stats.totalFields + fields,
      annotatedFields: stats.annotatedFields + annotatedFields,
      completedFiles: stats.completedFiles + (file.progress === 100 ? 1 : 0),
      totalFiles: stats.totalFiles + 1,
      totalAnnotations: stats.totalAnnotations + annotatedFields,
      targetAnnotations: stats.targetAnnotations + fields
    };

    console.log(`Stats updated for ${file.name}:`, {
      events,
      fields,
      annotatedFields,
      progress: file.progress
    });

    return newStats;
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

  console.log('------Raw files data in StatsPanel------:', JSON.stringify(files[0], null, 2));
  
  // Log incoming files data
  console.log('Files data received:', files);
  
  const stats = calculateStats(files);
  
  // Log calculated stats
  console.log('Calculated stats:', stats);

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
      value: `${stats.totalAnnotations.toLocaleString()} / ${stats.targetAnnotations.toLocaleString()}`,
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