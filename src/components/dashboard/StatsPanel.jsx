// StatsPanel.jsx
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

// Check if an event is fully annotated
const isEventAnnotated = (event) => {
  // Check if at least one event type field is filled
  const hasEventType = EVENT_TYPE_FIELDS.some(field => 
    event[field]?.trim().length > 0
  );

  // Check Main Action
  const hasMainAction = event['Main Action']?.trim().length > 0;

  // Check Arguments fields
  const hasArguments = event.Arguments && ARGUMENT_FIELDS.some(field => 
    event.Arguments[field]?.trim().length > 0
  );

  // Check Object fields
  const hasObject = event.Arguments?.Object && OBJECT_FIELDS.some(field => 
    event.Arguments.Object[field]?.trim().length > 0
  );

  return hasEventType && hasMainAction && hasArguments && hasObject;
};

// Count filled fields in an event
const countFilledFieldsInEvent = (event) => {
  let fieldCount = 0;
  let filledCount = 0;

  // Count event type fields
  EVENT_TYPE_FIELDS.forEach(field => {
    if (field in event) {
      fieldCount++;
      if (event[field]?.trim()) filledCount++;
    }
  });

  // Count Main Action
  if ('Main Action' in event) {
    fieldCount++;
    if (event['Main Action']?.trim()) filledCount++;
  }

  // Count Arguments fields
  if (event.Arguments) {
    ARGUMENT_FIELDS.forEach(field => {
      if (field in event.Arguments) {
        fieldCount++;
        if (event.Arguments[field]?.trim()) filledCount++;
      }
    });

    // Count Object fields
    if (event.Arguments.Object) {
      OBJECT_FIELDS.forEach(field => {
        if (field in event.Arguments.Object) {
          fieldCount++;
          if (event.Arguments.Object[field]?.trim()) filledCount++;
        }
      });
    }
  }

  return { total: fieldCount, filled: filledCount };
};

// Count events and fields in a file
const countEventsInFile = (file) => {
  if (!file?.papers?.length) {
    return { events: 0, totalFields: 0, filledFields: 0 };
  }

  let totalEvents = 0;
  let totalFields = 0;
  let filledFields = 0;

  file.papers.forEach((paper) => {
    if (!paper?.events?.length) return;

    paper.events.forEach(event => {
      totalEvents++;
      const { total, filled } = countFilledFieldsInEvent(event);
      totalFields += total;
      filledFields += filled;
    });
  });

  return { events: totalEvents, totalFields, filledFields };
};

// StatsCard component remains the same
const StatsCard = ({ title, value, icon: Icon, tooltip = '', trend = null, color = 'primary.main' }) => {
  const theme = useTheme();
  // ... StatsCard implementation stays the same
};

// StatsPanel component
const StatsPanel = ({ files = [], loading = false }) => {
  const theme = useTheme();

  // Calculate total papers and completed papers
  const paperStats = files.reduce((acc, file) => {
    const total = file.papers?.length || 0;
    const completed = file.papers?.filter(paper => 
      paper.events?.every(event => isEventAnnotated(event))
    ).length || 0;
    
    return {
      total: acc.total + total,
      completed: acc.completed + completed
    };
  }, { total: 0, completed: 0 });

  // Calculate event and field statistics
  const stats = files.reduce((acc, file) => {
    const { events, totalFields, filledFields } = countEventsInFile(file);
    
    return {
      totalEvents: acc.totalEvents + events,
      totalFields: acc.totalFields + totalFields,
      filledFields: acc.filledFields + filledFields
    };
  }, { totalEvents: 0, totalFields: 0, filledFields: 0 });

  // Stats configuration
  const statsConfig = [
    {
      title: 'Total Papers',
      value: paperStats.total,
      icon: EventsIcon,
      tooltip: 'Total number of papers across all files',
      color: theme.palette.primary.main
    },
    {
      title: 'Completed Papers',
      value: paperStats.completed,
      icon: CompletedIcon,
      tooltip: 'Number of papers with all events annotated',
      trend: paperStats.total > 0 ? Math.round((paperStats.completed / paperStats.total) * 100) : 0,
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
      value: `${stats.filledFields.toLocaleString()} / ${stats.totalFields.toLocaleString()}`,
      icon: ProgressIcon,
      tooltip: 'Total fields filled across all files',
      trend: stats.totalFields > 0 ? Math.round((stats.filledFields / stats.totalFields) * 100) : 0,
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