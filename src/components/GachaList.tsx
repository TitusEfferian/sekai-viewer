import {
  Card,
  CardContent,
  CardMedia,
  makeStyles,
  Typography,
  Container,
} from "@material-ui/core";
import { useLayoutStyles } from "../styles/layout";
import { Skeleton } from "@material-ui/lab";
import React, { Fragment, useEffect, useState } from "react";
import { Link, useHistory, useRouteMatch } from "react-router-dom";
import { useCachedData, useRefState } from "../utils";
import InfiniteScroll from "./subs/InfiniteScroll";

import { useTranslation } from "react-i18next";
import { ContentTransModeType } from "../types";
import { getAssetI18n } from "../utils/i18n";

const useStyles = makeStyles((theme) => ({
  media: {
    paddingTop: "56.25%",
    backgroundSize: "contain",
  },
  card: {
    // margin: theme.spacing(0.5),
    cursor: "pointer",
  },
  subheader: {
    "white-space": "nowrap",
    overflow: "hidden",
    "text-overflow": "ellipsis",
    "max-width": "260px",
  },
}));

interface GachaDetail {
  id: number;
  gachaId: number;
  cardId: number;
  weight: number;
}

interface GachaBehavior {
  id: number;
  gachaId: number;
  gachaBehaviorType: string;
  costResourceType: string;
  costResourceQuantity: number;
  spinCount: number;
  spinLimit: number;
}

interface GachaPickup {
  id: number;
  gachaId: number;
  cardId: number;
  gachaPickupType: string;
}

interface GachaInformation {
  gachaId: number;
  summary: string;
  description: string;
}

interface IGachaInfo {
  id: number;
  gachaType: string;
  name: string;
  seq: number;
  assetbundleName: string;
  rarity1Rate: number;
  rarity2Rate: number;
  rarity3Rate: number;
  rarity4Rate: number;
  startAt: number;
  endAt: number;
  gachaDetails: GachaDetail[];
  gachaBehaviors: GachaBehavior[];
  gachaPickups: GachaPickup[];
  gachaPickupCostumes: any[];
  gachaInformation: GachaInformation;
}

function getPaginatedGachas(gachas: IGachaInfo[], page: number, limit: number) {
  return gachas.slice(limit * (page - 1), limit * page);
}

const GachaList: React.FC<{ contentTransMode: ContentTransModeType }> = ({
  contentTransMode,
}) => {
  const classes = useStyles();
  const layoutClasses = useLayoutStyles();
  const history = useHistory();
  const { path } = useRouteMatch();
  const { t } = useTranslation();
  const assetI18n = getAssetI18n();

  const [gachas, setGachas] = useState<IGachaInfo[]>([]);
  // const [gachasCache, setGachasCache] = useState<IGachaInfo[]>([]);
  const [gachasCache, gachasCacheRef] = useCachedData<IGachaInfo>("gachas");

  const [page, pageRef, setPage] = useRefState<number>(1);
  const [limit, limitRef] = useRefState<number>(12);
  // const [, totalGachasRef, setTotalGachas] = useRefState<number>(0);
  const [, lastQueryFinRef, setLastQueryFin] = useRefState<boolean>(true);
  const [, isReadyRef, setIsReady] = useRefState<boolean>(false);

  useEffect(() => {
    document.title = "Gacha List | Sekai Viewer";
  }, []);

  useEffect(() => {
    setGachas((gachas) => [
      ...gachas,
      ...getPaginatedGachas(gachasCache, page, limit),
    ]);
    setLastQueryFin(true);
  }, [page, limit, setLastQueryFin, gachasCache]);

  useEffect(() => {
    setIsReady(Boolean(gachasCache.length));
  }, [setIsReady, gachasCache]);

  const callback = (
    entries: IntersectionObserverEntry[],
    setHasMore: React.Dispatch<React.SetStateAction<boolean>>
  ) => {
    if (!isReadyRef.current) return;
    if (
      entries[0].isIntersecting &&
      lastQueryFinRef.current &&
      (!gachasCacheRef.current.length ||
        gachasCacheRef.current.length > pageRef.current * limitRef.current)
    ) {
      setPage((page) => page + 1);
      setLastQueryFin(false);
    } else if (
      gachasCacheRef.current.length &&
      gachasCacheRef.current.length <= pageRef.current * limitRef.current
    ) {
      setHasMore(false);
    }
  };

  const ListCard: React.FC<{ data: IGachaInfo }> = ({ data }) => {
    return (
      <Link to={path + "/" + data.id} style={{ textDecoration: "none" }}>
        <Card className={classes.card}>
          <CardMedia
            className={classes.media}
            image={`https://sekai-res.dnaroma.eu/file/sekai-assets/gacha/${data.assetbundleName}/logo_rip/logo.webp`}
            title={data.name}
          ></CardMedia>
          <CardContent>
            <Typography variant="subtitle1" className={classes.subheader}>{
              contentTransMode === "original"
                ? data.name
                : contentTransMode === "translated"
                ? assetI18n.t(`gacha_name:${data.id}`)
                : data.name
            }</Typography>
          </CardContent>
        </Card>
      </Link>
    );
  };

  const ListLoading: React.FC<any> = () => {
    return (
      <Card className={classes.card}>
        <Skeleton variant="rect" className={classes.media}></Skeleton>
        <CardContent>
          <Typography variant="subtitle1" className={classes.subheader}>
            <Skeleton variant="text" width="80%"></Skeleton>
          </Typography>
        </CardContent>
      </Card>
    );
  };

  return (
    <Fragment>
      <Typography variant="h6" className={layoutClasses.header}>
        {t("common:gacha")}
      </Typography>
      <Container className={layoutClasses.content} maxWidth="md">
        {InfiniteScroll<IGachaInfo>({
          viewComponent: ListCard,
          loadingComponent: ListLoading,
          callback,
          data: gachas,
        })}
      </Container>
    </Fragment>
  );
};

export default GachaList;
