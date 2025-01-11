import React from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Tooltip,
  useTheme
} from '@mui/material';
import {
  FormatListBulleted as EventsIcon,
  CheckCircle as CompletedIcon,
  TrendingUp as ProgressIcon,
  Article as PaperIcon
} from '@mui/icons-material';

// Constants for field validation
const REQUIRED_EVENT_FIELDS = {
  eventTypes: [
    'Background/Introduction',
    'Methods/Approach',
    'Results/Findings',
    'Conclusions/Implications'
  ],
  mainAction: ['Main Action'],
  arguments: [
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
  ],
  objects: [
    'Base Object',
    'Base Modifier',
    'Attached Object',
    'Attached Modifier'
  ]
};

// Stats card component
const StatsCard = ({ title, value, icon: Icon, tooltip = '', trend = null, color = 'primary.main' }) => {
  const theme = useTheme();
  
  return (
    <Tooltip title={tooltip} arrow placement="top">
      <Card sx={{ height: '100%' }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <Icon sx={{ color, mr: 1 }} />
            <Typography variant="h6" component="div" color="text.secondary">
              {title}
            </Typography>
          </Box>
          
          <Typography variant="h4" component="div" sx={{ mb: trend !== null ? 1 : 0 }}>
            {value}
          </Typography>
          
          {trend !== null && (
            <Typography 
              variant="body2" 
              sx={{ 
                color: trend >= 70 ? 'success.main' : 
                       trend >= 30 ? 'warning.main' : 
                       'error.main'
              }}
            >
              {trend}% Complete
            </Typography>
          )}
        </CardContent>
      </Card>
    </Tooltip>
  );
};

// Helper function to check if an event is completely annotated
const isEventAnnotated = (event) => {
  if (!event) return false;

  // Check if at least one event type is filled
  const hasEventType = REQUIRED_EVENT_FIELDS.eventTypes.some(
    field => event[field]?.trim?.()
  );

  // Check Main Action
  const hasMainAction = event['Main Action']?.trim?.();

  // Check Arguments
  const hasArguments = event.Arguments && REQUIRED_EVENT_FIELDS.arguments.some(
    field => event.Arguments[field]?.trim?.()
  );

  // Check Objects
  const hasObjects = event.Arguments?.Object && REQUIRED_EVENT_FIELDS.objects.some(
    field => event.Arguments.Object[field]?.trim?.()
  );

  return hasEventType && hasMainAction && hasArguments && hasObjects;
};

// Helper function to count filled fields in an event
const countFilledFields = (event) => {
  if (!event) return { total: 0, filled: 0 };

  let totalFields = 0;
  let filledFields = 0;

  // Count event types
  REQUIRED_EVENT_FIELDS.eventTypes.forEach(field => {
    if (field in event) {
      totalFields++;
      if (event[field]?.trim?.()) filledFields++;
    }
  });

  // Count main action
  if ('Main Action' in event) {
    totalFields++;
    if (event['Main Action']?.trim?.()) filledFields++;
  }

  // Count arguments
  if (event.Arguments) {
    REQUIRED_EVENT_FIELDS.arguments.forEach(field => {
      if (field in event.Arguments) {
        totalFields++;
        if (event.Arguments[field]?.trim?.()) filledFields++;
      }
    });

    // Count object fields
    if (event.Arguments.Object) {
      REQUIRED_EVENT_FIELDS.objects.forEach(field => {
        if (field in event.Arguments.Object) {
          totalFields++;
          if (event.Arguments.Object[field]?.trim?.()) filledFields++;
        }
      });
    }
  }

  return { total: totalFields, filled: filledFields };
};

const StatsPanel = ({ files = [], loading = false }) => {
  const theme = useTheme();

  console.log('StatsPanel received files:', files);

  // Calculate statistics with error handling
  const stats = files.reduce((acc, file) => {
    try {
      // Process papers
      const papers = file.papers || [];
      const totalPapers = papers.length;
      
      // Process events
      let totalEvents = 0;
      let totalFields = 0;
      let filledFields = 0;
      let completedPapers = 0;

      papers.forEach(paper => {
        const events = paper.events || [];
        const isComplete = events.every(event => isEventAnnotated(event));
        if (isComplete) completedPapers++;
        
        events.forEach(event => {
          totalEvents++;
          const { total, filled } = countFilledFields(event);
          totalFields += total;
          filledFields += filled;
        });
      });

      return {
        papers: acc.papers + totalPapers,
        completedPapers: acc.completedPapers + completedPapers,
        events: acc.events + totalEvents,
        totalFields: acc.totalFields + totalFields,
        filledFields: acc.filledFields + filledFields
      };
    } catch (error) {
      console.error('Error processing file stats:', error);
      return acc;
    }
  }, {
    papers: 0,
    completedPapers: 0,
    events: 0,
    totalFields: 0,
    filledFields: 0
  });

  const statsConfig = [
    {
      title: 'Total Papers',
      value: stats.papers,
      icon: PaperIcon,
      tooltip: 'Total number of papers across all files',
      color: theme.palette.primary.main
    },
    {
      title: 'Completed Papers',
      value: stats.completedPapers,
      icon: CompletedIcon,
      tooltip: 'Papers with all events fully annotated',
      trend: stats.papers > 0 ? Math.round((stats.completedPapers / stats.papers) * 100) : 0,
      color: theme.palette.success.main
    },
    {
      title: 'Total Events',
      value: stats.events,
      icon: EventsIcon,
      tooltip: 'Total number of events across all papers',
      color: theme.palette.info.main
    },
    {
      title: 'Annotation Progress',
      value: `${stats.filledFields.toLocaleString()} / ${stats.totalFields.toLocaleString()}`,
      icon: ProgressIcon,
      tooltip: 'Total annotated fields vs total available fields',
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