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
  CheckCircle as CompletedIcon,
  TrendingUp as ProgressIcon
} from '@mui/icons-material';

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

// Function to count fields in an event
const countFieldsInEvent = (event) => {
  let fieldCount = 0;

  // Count event type fields that are present and non-empty
  EVENT_TYPE_FIELDS.forEach(field => {
    if (event[field] && event[field].trim() !== '') {
      fieldCount++;
    }
  });

  // Count Main Action if present and non-empty
  if (event['Main Action'] && event['Main Action'].trim() !== '') {
    fieldCount++;
  }

  // Count Arguments fields that are present and non-empty
  if (event.Arguments) {
    ARGUMENT_FIELDS.forEach(field => {
      if (event.Arguments[field] && event.Arguments[field].trim() !== '') {
        fieldCount++;
      }
    });

    // Count Object fields that are present and non-empty
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

// Function to count events and fields in a file
const countEventsInFile = (file) => {
  if (!file?.abstracts?.length) {
    return { events: 0, fields: 0 };
  }

  let totalEvents = 0;
  let totalFields = 0;

  file.abstracts.forEach((abstract) => {
    if (!abstract?.events?.length) {
      return;
    }

    const eventsInAbstract = abstract.events.length;
    const fieldsInAbstract = abstract.events.reduce((sum, event) => {
      return sum + countFieldsInEvent(event);
    }, 0);

    totalEvents += eventsInAbstract;
    totalFields += fieldsInAbstract;
  });

  return { events: totalEvents, fields: totalFields };
};

// StatsCard component
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

// StatsPanel component
const StatsPanel = ({ files = [], loading = false }) => {
  const theme = useTheme();

  // Calculate total abstracts and completed abstracts
  const totalAbstracts = files.reduce((total, file) => total + (file.abstracts?.length || 0), 0);
  const completedAbstracts = files.reduce((total, file) => {
    return total + (file.abstracts?.filter(abstract => abstract.events?.every(event => event.isAnnotated)).length || 0);
  }, 0);

  // Calculate total events and fields
  const stats = files.reduce((stats, file) => {
    const { events, fields } = countEventsInFile(file);
    const annotatedFields = Math.floor((file.progress || 0) * fields / 100);

    return {
      totalEvents: stats.totalEvents + events,
      totalFields: stats.totalFields + fields,
      annotatedFields: stats.annotatedFields + annotatedFields,
      completedFiles: stats.completedFiles + (file.progress === 100 ? 1 : 0),
      totalFiles: stats.totalFiles + 1,
      totalAnnotations: stats.totalAnnotations + annotatedFields,
      targetAnnotations: stats.targetAnnotations + fields
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

  // Stats configuration
  const statsConfig = [
    {
      title: 'Total Abstracts',
      value: totalAbstracts,
      icon: EventsIcon,
      tooltip: 'Total number of abstracts across all files',
      color: theme.palette.primary.main
    },
    {
      title: 'Completed Abstracts',
      value: completedAbstracts,
      icon: CompletedIcon,
      tooltip: 'Number of abstracts with all events annotated',
      trend: totalAbstracts > 0 ? Math.round((completedAbstracts / totalAbstracts) * 100) : 0,
      color: theme.palette.success.main
    },
    {
      title: 'Total Events',
      value: stats.totalEvents,
      icon: EventsIcon,
      tooltip: 'Total number of events across all files',
      color: theme.palette.info.main
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