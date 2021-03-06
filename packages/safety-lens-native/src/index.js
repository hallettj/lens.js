/* @flow */

import * as Arr from 'flow-static-land/lib/Arr'
import * as Identity from 'flow-static-land/lib/Identity'
import { foldrOf, lens, traverse } from 'safety-lens'

import type { Applicative } from 'flow-static-land/lib/Applicative'
import type { Endomorphism } from 'flow-static-land/lib/Fun'
import type { Functor } from 'flow-static-land/lib/Functor'
import type { HKT } from 'flow-static-land/lib/HKT'
import type { Fold, Lens, Lens_, Traversal } from 'safety-lens'
import type { Getting } from 'safety-lens/lib/getter'

/* arrays */

export function index<A, B> (idx: number): Traversal<A[], (A | B)[], A, B> {
  return function<F, Instance: Applicative<F>> (
    f: (instance: Instance, val: *) => HKT<F, *>
  ): (instance: Instance, obj: *) => HKT<F, *> {
    return (instance, array) => {
      if (typeof array[idx] !== 'undefined') {
        return instance.map(
          updatedValue => array.map((v, i) => (i === idx ? updatedValue : v)),
          f(instance, array[idx])
        )
      } else {
        return instance.of(array)
      }
    }
  }
}

export function toArrayOf<S, A> (
  lens: Getting<Endomorphism<A[]>, S, A>,
  obj: S
): A[] {
  return foldrOf(
    lens,
    (x, xs) => {
      xs.unshift(x)
      return xs
    },
    [],
    obj
  )
}

// Traversal<A[], B[], A, B>
export function traverseArray<A, B, F, Instance: Applicative<F>> (
  f: (instance: Instance, val: A) => HKT<F, B>
): (instance: Instance, obj: A[]) => HKT<F, B[]> {
  return (instance, obj) => {
    // Embed the array in a `Arr.List` type so that we can use the `Arr`
    // instance for `Traversable`
    const arr = Arr.inj(obj)
    const resultArr = traverse(Arr, f)(instance, arr)

    // Extract a native array from the result
    return instance.map(Arr.prj, resultArr)
  }
}

/* objects */

/*
 * Access a property in an object. Flow will emit an error if the named property
 * is not a member of the target object type.
 */
export function prop<S: Object, T: Object, A, B> (
  name: $Keys<S> | $Keys<T>
): Lens<S, T, A, B> {
  return (key(name): any) // cast from `Traversal` to `Lens`
}

/*
 * Access a property in an object. With this version, flow will not check if the
 * property exists in the target type. Use `key` instead of `prop` when the
 * target is used as a map (as opposed to a record), or when an undefined result
 * is acceptable.
 */
export function key<A, B> (
  name: string
): Traversal<{ [key: string]: A }, { [key: string]: A | B }, A, B> {
  return lens(
    obj => obj[name],
    (obj, val) => {
      const newObj = {}
      for (const k of Object.keys(obj)) {
        if (k !== name) {
          newObj[k] = obj[k]
        }
      }
      if (typeof val !== 'undefined') {
        newObj[name] = val
      }
      return newObj
    }
  )
}

/* tuples */

// Lens<[A,B],[C,B],A,C>
export function _1<A, B, C, F, Instance: Functor<F>> (
  f: (instance: Instance, val: A) => HKT<F, C>
): (instance: Instance, obj: [A, B]) => HKT<F, [C, B]> {
  return (instance, [a, b]) => instance.map(c => [c, b], f(instance, a))
}

// Lens<[A,B],[A,C],B,C>
export function _2<A, B, C, F, Instance: Functor<F>> (
  f: (instance: Instance, val: B) => HKT<F, C>
): (instance: Instance, obj: [A, B]) => HKT<F, [A, C]> {
  return (instance, [a, b]) => instance.map(c => [a, c], f(instance, b))
}

/* Promise */

// Traversal<Promise<A>, Promise<B>, A, B>
export function success<A, B, Instance: Applicative<*>> (
  f: (instance: Instance, val: A) => Identity.Identity<B>
): (instance: Instance, obj: Promise<A>) => Identity.Identity<Promise<B>> {
  return (instance, promise) =>
    instance.of(promise.then(a => Identity.extract(f(instance, a))))
}

// Traversal<Promise<X>, Promise<X>, A, B>
export function failure<X, A, B, Instance: Applicative<*>> (
  f: (instance: Instance, val: A) => Identity.Identity<B>
): (instance: Instance, obj: Promise<X>) => Identity.Identity<Promise<X>> {
  return (instance, promise) =>
    instance.of(
      promise.then(Identity.id, a =>
        Promise.reject(Identity.extract(f(instance, a)))
      )
    )
}
