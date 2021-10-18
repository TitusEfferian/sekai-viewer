import {
  Button,
  CircularProgress,
  Container,
  FormControlLabel,
  FormGroup,
  // Divider,
  Grid,
  // LinearProgress,
  makeStyles,
  Paper,
  Slider,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from "@material-ui/core";
import { Alert, Autocomplete } from "@material-ui/lab";
import { CronJob } from "cron";
import React, {
  Fragment,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import { SettingContext, UserContext } from "../../context";
import { useLayoutStyles } from "../../styles/layout";
import {
  EventPrediction,
  EventRankingResponse,
  IEventInfo,
  UserRanking,
} from "../../types";
import {
  useCachedData,
  useQuery,
  useServerRegion,
  useToggle,
} from "../../utils";
import { useCurrentEvent } from "../../utils/apiClient";
import {
  useEventTrackerAPI,
  useRealtimeEventData,
} from "../../utils/eventTracker";
import { useAssetI18n } from "../../utils/i18n";
import { HistoryMobileRow, LiveMobileRow } from "./EventTrackerMobileRow";
// import DegreeImage from "../subs/DegreeImage";
import { HistoryRow, LiveRow } from "./EventTrackerTableRow";
import { useDebouncedCallback } from "use-debounce";
import SekaiEventRecord from "./SekaiEventRecord";
import AdSense from "../subs/AdSense";

const useStyles = makeStyles(() => ({
  eventSelect: {
    width: "100%",
    maxWidth: 300,
  },
}));

const EventTracker: React.FC<{}> = () => {
  const layoutClasses = useLayoutStyles();
  const classes = useStyles();
  const query = useQuery();
  const theme = useTheme();
  const { t } = useTranslation();
  const { getTranslated } = useAssetI18n();
  const [region] = useServerRegion();
  const {
    getLive,
    getEventPred,
    getEventTimePoints,
    getEventRankingsByTimestamp,
  } = useEventTrackerAPI(region);
  const { contentTransMode } = useContext(SettingContext)!;
  const { sekaiProfile } = useContext(UserContext)!;
  const refreshData = useRealtimeEventData();
  const { currEvent, isLoading: isCurrEventLoading } = useCurrentEvent();

  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const [events] = useCachedData<IEventInfo>("events");
  const [selectedEvent, setSelectedEvent] = useState<{
    name: string;
    id: number;
  } | null>(null);
  const [selectedEventId, setSelectedEventId] = useState(0);
  // const [fetchProgress, setFetchProgress] = useState(0);
  const [isFetching, setIsFetching] = useState(false);

  const [rtRanking, setRtRanking] = useState<EventRankingResponse[]>([]);
  const [rtTime, setRtTime] = useState<Date>();
  const [historyRanking, setHistoryRanking] = useState<UserRanking[]>([]);
  const [historyTime, setHistoryTime] = useState<Date>();
  const [nextRefreshTime, setNextRefreshTime] = useState<moment.Moment>();
  const [refreshCron, setRefreshCron] = useState<CronJob>();
  const [isFullRank, toggleIsFullRank] = useToggle(false);
  const [isTimeTravel, toggleIsTimeTravel] = useToggle(false);
  // const [isGetPred, toggleIsGetPred] = useToggle(false);
  const [eventDuration, setEventDuration] = useState(0);
  const [predCron, setPredCron] = useState<CronJob>();
  const [predData, setPredData] = useState<EventPrediction>();
  const [timePoints, setTimePoints] = useState<Date[]>([]);
  const [sliderTime, setSliderTime] = useState<Date>();
  const [sliderDefaultTime, setSliderDefaultTime] = useState<Date>();
  const [sliderTimeRanking, setSliderTimeRanking] = useState<
    EventRankingResponse[]
  >([]);
  const [fetchingTimePoints, toggleFetchingTimePoints] = useToggle(false);

  const fullRank = useMemo(
    () => [
      1,
      2,
      3,
      4,
      5,
      6,
      7,
      8,
      9,
      10,
      20,
      30,
      40,
      50,
      100,
      200,
      300,
      400,
      500,
      1000,
      2000,
      3000,
      4000,
      5000,
      10000,
      20000,
      30000,
      40000,
      50000,
      100000,
    ],
    []
  );

  const critialRank = useMemo(
    () => [1, 2, 3, 10, 100, 1000, 5000, 10000, 50000, 100000],
    []
  );

  useEffect(() => {
    document.title = t("title:eventTracker");
  }, [t]);

  useEffect(() => {
    return () => {
      if (refreshCron) refreshCron.stop();
    };
  }, [refreshCron]);

  useEffect(() => {
    return () => {
      if (predCron) predCron.stop();
    };
  }, [predCron]);

  const refreshRealtimeData = useCallback(async () => {
    setIsFetching(true);
    const data = await getLive();
    setRtRanking(data);
    setRtTime(new Date(data[0].timestamp));
    setIsFetching(false);
  }, [getLive]);

  const refreshPrediction = useCallback(async () => {
    const data = await getEventPred();
    setPredData(data);
  }, [getEventPred]);

  const getHistoryData = useCallback(
    async (eventId: number) => {
      const data = await refreshData(eventId, region);
      setHistoryTime(new Date(data.time));
      const rankingData = Object.values(data).filter((elem) =>
        Array.isArray(elem)
      ) as UserRanking[][];
      // console.log(Object.values(data), rankingData);
      setHistoryRanking(
        rankingData.reduce(
          (sum, elem) => [...sum, ...elem],
          []
        ) as UserRanking[]
      );
    },
    [refreshData, region]
  );

  const handleFetchGraph = useCallback(
    async (eventId: number) => {
      if (!events || !events.length) return;
      setSelectedEventId(0);
      setRtRanking([]);
      setRtTime(undefined);
      setHistoryRanking([]);
      setHistoryTime(undefined);
      setPredData(undefined);
      setNextRefreshTime(undefined);
      setTimePoints([]);
      setSliderTime(undefined);
      setSliderDefaultTime(undefined);
      setSliderTimeRanking([]);

      // setFetchProgress(0);
      // setIsFetching(true);
      if (!eventId) {
        // setIsFetching(false);
        return;
      }

      // real time data
      const event = events.find((elem) => elem.id === eventId)!;
      if (currEvent?.eventId === eventId) {
        // get realtime data from live endpoint
        const currentTime = Date.now();
        if (
          event &&
          currentTime >= event.startAt &&
          currentTime < event.aggregateAt
        ) {
          const cron = new CronJob("10 * * * * *", () => {
            const currentTime = Date.now();
            if (currentTime >= event.aggregateAt) cron.stop();
            else {
              refreshRealtimeData();
              setEventDuration(currentTime - event.startAt);
              setNextRefreshTime(cron.nextDate());
            }
          });
          cron.start();
          setRefreshCron(cron);
          refreshRealtimeData();
          setEventDuration(currentTime - event.startAt);
          setNextRefreshTime(cron.nextDate());

          if (
            region === "jp" &&
            currentTime >= event.startAt + 24 * 3600 * 1000
          ) {
            const predcron = new CronJob("1,16,31,46 * * * *", () => {
              const currentTime = Date.now();
              if (currentTime >= event.rankingAnnounceAt) predcron.stop();
              else {
                refreshPrediction();
                // setNextRefreshTime(cron.nextDate());
              }
            });
            predcron.start();
            setPredCron(predcron);
            refreshPrediction();
          }
        } else if (event && currentTime >= event.aggregateAt) {
          getHistoryData(event.id);
          setEventDuration(event.aggregateAt - event.startAt);
        }
      } else {
        getHistoryData(event.id);
        setEventDuration(event.aggregateAt - event.startAt);
      }

      setSelectedEventId(eventId);
      // setIsFetching(false);
    },
    [
      currEvent?.eventId,
      events,
      getHistoryData,
      refreshPrediction,
      refreshRealtimeData,
      region,
    ]
  );

  useEffect(() => {
    if (currEvent && events) {
      if (query.get("id") && !Number.isNaN(Number(query.get("id")))) {
        if (events.length) {
          const ev = events.find((elem) => elem.id === Number(query.get("id")));
          if (ev) {
            setSelectedEvent({
              name: getTranslated(`event_name:${query.get("id")}`, ev.name),
              id: ev.id,
            });
            handleFetchGraph(ev.id);
          }
        }
      } else {
        setSelectedEvent({
          name: getTranslated(
            `event_name:${currEvent.eventId}`,
            currEvent.eventJson.name
          ),
          id: currEvent.eventId,
        });
        handleFetchGraph(currEvent.eventId);
      }
    }
  }, [
    contentTransMode,
    currEvent,
    events,
    getTranslated,
    handleFetchGraph,
    query,
  ]);

  const handleSliderChange = useDebouncedCallback(
    async (_, value: number | number[]) => {
      // setSliderTimeRanking([]);
      toggleFetchingTimePoints();
      setSliderTime(new Date(value as number));
      setSliderTimeRanking(
        (
          await getEventRankingsByTimestamp(
            selectedEventId,
            new Date(value as number)
          )
        ).data.eventRankings
      );
      toggleFetchingTimePoints();
    },
    200
  );

  const handleTimeTravelChange = useCallback(
    async (_, checked) => {
      if (checked && !timePoints.length) {
        toggleFetchingTimePoints();
        const tps = (await getEventTimePoints(selectedEventId)).data.map(
          (dateString) => new Date(dateString)
        );
        setTimePoints(tps);
        setSliderTime(tps[tps.length - 1]);
        setSliderDefaultTime(tps[tps.length - 1]);
        setSliderTimeRanking(
          (
            await getEventRankingsByTimestamp(
              selectedEventId,
              tps[tps.length - 1]
            )
          ).data.eventRankings
        );
        toggleFetchingTimePoints();
      }
      toggleIsTimeTravel();
    },
    [
      getEventRankingsByTimestamp,
      getEventTimePoints,
      selectedEventId,
      timePoints.length,
      toggleFetchingTimePoints,
      toggleIsTimeTravel,
    ]
  );

  return (
    <Fragment>
      <Typography variant="h6" className={layoutClasses.header}>
        {t("common:eventTracker")}
      </Typography>
      <Container className={layoutClasses.content}>
        <Grid container spacing={1} alignItems="center">
          <Grid item className={classes.eventSelect}>
            <Autocomplete
              options={(events || [])
                .slice()
                .reverse()
                .filter((ev) => ev.startAt <= new Date().getTime())
                .map((ev) => ({
                  name: getTranslated(`event_name:${ev.id}`, ev.name),
                  id: ev.id,
                }))}
              getOptionLabel={(option) => option.name}
              getOptionSelected={(option, value) => option.id === value.id}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label={t("event:tracker.select.event_name")}
                />
              )}
              value={selectedEvent}
              autoComplete
              onChange={(_, value) => {
                if (!!value) {
                  setSelectedEvent(value);
                  setRefreshCron(undefined);
                  setPredCron(undefined);
                  handleFetchGraph(value.id);
                }
              }}
              disabled={isCurrEventLoading || isFetching}
            />
          </Grid>
          <Grid item>
            <Button
              variant="contained"
              onClick={() => {
                setSelectedEvent({
                  name: getTranslated(
                    `event_name:${currEvent.eventId}`,
                    currEvent.eventJson.name
                  ),
                  id: currEvent.eventId,
                });
                setRefreshCron(undefined);
                setPredCron(undefined);
                handleFetchGraph(currEvent.eventId);
              }}
              disabled={isCurrEventLoading || isFetching}
            >
              {t("event:tracker.button.curr_event")}
            </Button>
          </Grid>
        </Grid>
      </Container>
      {region === "jp" && !!sekaiProfile && !!sekaiProfile.sekaiUserProfile && (
        <Fragment>
          <Typography variant="h6" className={layoutClasses.header}>
            {t("user:profile.title.user_event")}
          </Typography>
          <Container className={layoutClasses.content}>
            <SekaiEventRecord eventId={selectedEventId} />
          </Container>
        </Fragment>
      )}
      <Typography variant="h6" className={layoutClasses.header}>
        {t("event:ranking")} {isFetching && <CircularProgress size="24px" />}
      </Typography>
      {!!selectedEventId && (!!rtRanking.length || !!historyRanking.length) && (
        <Container className={layoutClasses.content}>
          <Typography variant="h6">
            {t("event:realtime")}{" "}
            {isTimeTravel
              ? sliderTime?.toLocaleString()
              : (rtTime || historyTime || new Date(0)).toLocaleString()}
          </Typography>
          {!!nextRefreshTime && (
            <Typography variant="body2" color="textSecondary">
              {t("event:nextfetch")}: {nextRefreshTime.fromNow()}
            </Typography>
          )}
          {!!predData && (
            <Typography variant="body2" color="textSecondary">
              {t("event:tracker.pred_at")}:{" "}
              {new Date(predData.data.ts).toLocaleString()}
            </Typography>
          )}
          <FormGroup row>
            <FormControlLabel
              control={
                <Switch
                  checked={isFullRank}
                  onChange={() => toggleIsFullRank()}
                />
              }
              label={t("event:tracker.show_all_rank")}
            />
            <FormControlLabel
              control={
                <Switch
                  checked={isTimeTravel}
                  onChange={handleTimeTravelChange}
                  disabled={fetchingTimePoints}
                />
              }
              label={
                <Typography>
                  {t("event:tracker.time_travel_enabled")}{" "}
                  {fetchingTimePoints && <CircularProgress size="12px" />}
                </Typography>
              }
            />
          </FormGroup>
          {isTimeTravel && (
            <Slider
              step={null}
              min={timePoints[0].getTime()}
              max={timePoints[timePoints.length - 1].getTime()}
              marks={timePoints.map((tp) => ({ value: tp.getTime() }))}
              disabled={fetchingTimePoints}
              defaultValue={sliderDefaultTime?.getTime()}
              onChange={handleSliderChange.callback}
            />
          )}
          {!isTimeTravel && !!rtRanking.length && !!rtTime && (
            <Alert severity="info" className={layoutClasses.alert}>
              <Typography>
                {t("event:tracker.tooltip.get_prediction")}
              </Typography>
            </Alert>
          )}
          {!isTimeTravel &&
            !!rtRanking.length &&
            !!rtTime &&
            (isMobile ? (
              <Grid container spacing={1}>
                {events &&
                  (isFullRank ? fullRank : critialRank).map((rank) => (
                    <Grid key={rank} item xs={12}>
                      <LiveMobileRow
                        rankingData={
                          rtRanking.find((elem) => elem.rank === rank) || {
                            id: -1,
                            eventId: selectedEventId,
                            timestamp: "0",
                            rank,
                            score: 0,
                            userId: "0",
                            userName: "N/A",
                          }
                        }
                        rankingPred={predData?.data[String(rank) as "100"]}
                      />
                    </Grid>
                  ))}
              </Grid>
            ) : (
              <TableContainer component={Paper}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell />
                      <TableCell align="center">{t("event:ranking")}</TableCell>
                      <TableCell align="center">
                        {t("event:rankingTable.head.userProfile")}
                      </TableCell>
                      <TableCell align="right">
                        {t("event:rankingTable.head.score")}
                      </TableCell>
                      <TableCell align="right">
                        {t("event:rankingTable.head.speed_per_hour")}
                      </TableCell>
                      <TableCell align="right">
                        {t("event:rankingTable.head.prediction")}
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {events &&
                      (isFullRank ? fullRank : critialRank).map((rank) => (
                        <LiveRow
                          key={rank}
                          rankingReward={events
                            .find((ev) => ev.id === selectedEventId)!
                            .eventRankingRewardRanges.find(
                              (r) => r.toRank === rank
                            )}
                          rankingData={
                            rtRanking.find((elem) => elem.rank === rank) || {
                              id: -1,
                              eventId: selectedEventId,
                              timestamp: "0",
                              rank,
                              score: 0,
                              userId: "0",
                              userName: "N/A",
                            }
                          }
                          eventDuration={eventDuration}
                          rankingPred={predData?.data[String(rank) as "100"]}
                        />
                      ))}
                  </TableBody>
                </Table>
              </TableContainer>
            ))}
          {!isTimeTravel &&
            !!historyRanking.length &&
            !!historyTime &&
            (isMobile ? (
              <Grid container spacing={1}>
                {events &&
                  (isFullRank ? fullRank : critialRank).map((rank) => (
                    <Grid key={rank} item xs={12}>
                      <HistoryMobileRow
                        rankingData={
                          historyRanking.find((elem) => elem.rank === rank)!
                        }
                        eventId={selectedEvent!.id}
                      />
                    </Grid>
                  ))}
              </Grid>
            ) : (
              <TableContainer component={Paper}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell />
                      <TableCell align="center">{t("event:ranking")}</TableCell>
                      <TableCell align="center">
                        {t("event:rankingTable.head.userProfile")}
                      </TableCell>
                      <TableCell align="right">
                        {t("event:rankingTable.head.score")}
                      </TableCell>
                      <TableCell align="right">
                        {t("event:rankingTable.head.speed_per_hour")}
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {events &&
                      (isFullRank ? fullRank : critialRank).map((rank) => (
                        <HistoryRow
                          key={rank}
                          rankingReward={events
                            .find((ev) => ev.id === selectedEventId)!
                            .eventRankingRewardRanges.find(
                              (r) => r.toRank === rank
                            )}
                          rankingData={
                            historyRanking.find((elem) => elem.rank === rank)!
                          }
                          eventDuration={eventDuration}
                          eventId={selectedEvent!.id}
                        />
                      ))}
                  </TableBody>
                </Table>
              </TableContainer>
            ))}
          {isTimeTravel &&
            !!sliderTimeRanking.length &&
            (isMobile ? (
              <Grid container spacing={1}>
                {events &&
                  (isFullRank ? fullRank : critialRank).map((rank) => (
                    <Grid key={rank} item xs={12}>
                      <LiveMobileRow
                        rankingData={
                          sliderTimeRanking.find(
                            (elem) => elem.rank === rank
                          ) || {
                            id: -1,
                            eventId: selectedEventId,
                            timestamp: "0",
                            rank,
                            score: 0,
                            userId: "0",
                            userName: "N/A",
                          }
                        }
                        noPred={true}
                      />
                    </Grid>
                  ))}
              </Grid>
            ) : (
              <TableContainer component={Paper}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell />
                      <TableCell align="center">{t("event:ranking")}</TableCell>
                      <TableCell align="center">
                        {t("event:rankingTable.head.userProfile")}
                      </TableCell>
                      <TableCell align="right">
                        {t("event:rankingTable.head.score")}
                      </TableCell>
                      <TableCell align="right">
                        {t("event:rankingTable.head.speed_per_hour")}
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {events &&
                      (isFullRank ? fullRank : critialRank).map((rank) => (
                        <LiveRow
                          key={rank}
                          rankingReward={events
                            .find((ev) => ev.id === selectedEventId)!
                            .eventRankingRewardRanges.find(
                              (r) => r.toRank === rank
                            )}
                          rankingData={
                            sliderTimeRanking.find(
                              (elem) => elem.rank === rank
                            ) || {
                              id: -1,
                              eventId: selectedEventId,
                              timestamp: "0",
                              rank,
                              score: 0,
                              userId: "0",
                              userName: "N/A",
                            }
                          }
                          eventDuration={eventDuration}
                          noPred={true}
                        />
                      ))}
                  </TableBody>
                </Table>
              </TableContainer>
            ))}
        </Container>
      )}
      <AdSense
        client="ca-pub-7767752375383260"
        slot="8221864477"
        format="auto"
        responsive="true"
      />
    </Fragment>
  );
};

export default EventTracker;
