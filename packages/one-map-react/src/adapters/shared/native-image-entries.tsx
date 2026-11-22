import { Fragment, type ReactElement } from "react";

import type { ImagesProps, UrlImage } from "../../contracts/images-types.js";

/** Replaces only the wrapper registration whose image URL or SDF flag changes. */
export const renderNativeImageEntries = (
  images: ImagesProps["images"],
  render: (name: string, entry: UrlImage) => ReactElement
): ReactElement => (
  <>
    {Object.entries(images).map(([name, value]) => {
      // The RNMapbox iOS loader reads a URL dictionary, including for shorthand URLs.
      const image = typeof value === "string" ? { url: value } : value;
      return (
        <Fragment key={JSON.stringify([name, image.url, image.sdf ?? false])}>
          {render(name, image)}
        </Fragment>
      );
    })}
  </>
);
